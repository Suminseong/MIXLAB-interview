document.addEventListener("DOMContentLoaded", () => {
    // ===== 공통 유틸 =====
    // ==== 임베딩 & 유틸 ====
    let _qEmbeddings = null; // 질문별 임베딩 캐시

    async function embedText(apiKey, text) {
        const res = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify({ model: "text-embedding-3-small", input: text })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Embeddings API error");
        return data.data[0].embedding;
    }
    function cosineSim(a, b) {
        let dot = 0, na = 0, nb = 0;
        for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
        return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
    }
    async function ensureQuestionEmbeddings(apiKey, questions) {
        if (!Array.isArray(questions) || questions.length === 0) { _qEmbeddings = null; return; }
        _qEmbeddings = await Promise.all(questions.map(q => embedText(apiKey, q)));
    }

    // ==== 질문 인덱스 분류 ====
    const ACK_REGEX = /^(네|넵|예|응|어|음|아|맞[아요]|그렇[죠|습니다]?|좋[아요]|오케이|ok)\s*$/i;

    async function classifyQuestionIndex(userText, lastIndex, questions, apiKey) {
        // 0) 무의미/짧은 추임새면 현재 유지
        if (!userText || userText.trim().length < 2 || ACK_REGEX.test(userText.trim()))
            return { index: Math.max(0, lastIndex), score: 0, reason: "ack/short" };

        if (!_qEmbeddings) await ensureQuestionEmbeddings(apiKey, questions);
        if (!_qEmbeddings) return { index: Math.max(0, lastIndex), score: 0, reason: "no-emb" };

        // 1) 유사도 계산
        const uEmb = await embedText(apiKey, userText);
        const sims = _qEmbeddings.map((e, i) => ({ i, s: cosineSim(uEmb, e) }));
        sims.sort((a, b) => b.s - a.s);
        const best = sims[0];
        const second = sims[1] || { s: 0 };

        // 2) 흐름 안정화 규칙
        let idx = best.i + 1; // 질문 배열은 0-based, 우리 인덱스는 1부터
        const margin = best.s - second.s;

        // 너무 큰 점프 방지(예: lastIndex=2 → 7로 점프)
        const bigJump = Math.abs(idx - Math.max(1, lastIndex)) >= 3;
        if (bigJump && margin < 0.06) {
            // 점프 근거가 약하면 이전/다음으로 스냅
            idx = (best.i + 1 > lastIndex) ? lastIndex + 1 : Math.max(1, lastIndex);
        }

        // 경계값(애매하면 유지)
        if (best.s < 0.24) {
            idx = Math.max(1, lastIndex); // 너무 애매하면 같은 번호 유지
        }

        // “다음으로/이제 ~” 같은 진행 신호(간단 휴리스틱)
        if (/(다음|이제|넘어가|본론|그럼)/.test(userText) && lastIndex >= 0) {
            idx = Math.min((questions?.length || idx), Math.max(1, lastIndex + 1));
        }

        return { index: idx, score: best.s, reason: `best=${best.s.toFixed(3)} margin=${margin.toFixed(3)}` };
    }
    function msToMinSec(ms) {
        const totalSec = Math.max(0, Math.floor(ms / 1000));
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m}m ${String(s).padStart(2, '0')}s`;
    }

    function sum(arr) { return arr.reduce((a, b) => a + b, 0); }

    function byCountDesc(a, b) { return b.count - a.count; }

    const KO_STOPWORDS = new Set([
        '그리고', '그러나', '하지만', '그러면', '그래서', '또', '또는', '즉', '혹은',
        '이것', '저것', '그것', '거기', '여기', '저기', '좀', '아주', '매우', '너무',
        '정말', '진짜', '거의', '약간', '등', '등등', '같은', '것', '수', '때', '점', '및',
        '는', '은', '이', '가', '을', '를', '에', '의', '로', '으로', '와', '과', '도', '만',
        '에게', '한', '하다', '했습니다', '했어요', '하는', '되다', '됐다', '됐다가',
    ]);


    function simpleTokenizeKorean(text) {
        return (text || "")
            .replace(/[^\p{Script=Hangul}\w\s]/gu, " ")
            .toLowerCase()
            .split(/\s+/)
            .filter(t => t && t.length > 1 && !KO_STOPWORDS.has(t));
    }
    // ===== 인터뷰 로그 파생 데이터 =====
    function deriveInterviewMetrics(interviewLog, totalQuestionsHint = null) {
        if (!Array.isArray(interviewLog) || interviewLog.length === 0) {
            return {
                perQuestion: [],
                labels: [],
                durationsSec: [],
                totalMs: 0,
                firstTs: null,
                lastTs: null,
                answeredSet: new Set(),
                totalQuestions: totalQuestionsHint || 0
            };
        }

        const perQuestionMap = new Map(); // key: index, val: { index, durations:[] }
        let firstTs = Infinity, lastTs = -Infinity;

        for (const row of interviewLog) {
            const idx = Number(row.questionIndex ?? 0); // 0=아이스브레이킹
            const dur = Math.max(0, (row.timestampEnd || 0) - (row.timestampStart || 0));
            if (!perQuestionMap.has(idx)) perQuestionMap.set(idx, { index: idx, durations: [] });
            perQuestionMap.get(idx).durations.push(dur);

            if (row.timestampStart) firstTs = Math.min(firstTs, row.timestampStart);
            if (row.timestampEnd) lastTs = Math.max(lastTs, row.timestampEnd);
        }

        const perQuestion = Array.from(perQuestionMap.values())
            .sort((a, b) => a.index - b.index)
            .map(q => ({
                index: q.index,
                meanMs: q.durations.length ? sum(q.durations) / q.durations.length : 0,
                count: q.durations.length
            }));

        const labels = perQuestion.map(q => (q.index === 0 ? 'Ice' : `Q${q.index}`));
        const durationsSec = perQuestion.map(q => (q.meanMs / 1000).toFixed(1));

        const totalMs = (isFinite(firstTs) && isFinite(lastTs) && lastTs >= firstTs) ? (lastTs - firstTs) : 0;
        const answeredSet = new Set(perQuestion.filter(q => q.index > 0).map(q => q.index));

        return {
            perQuestion, labels, durationsSec, totalMs,
            firstTs: isFinite(firstTs) ? firstTs : null,
            lastTs: isFinite(lastTs) ? lastTs : null,
            answeredSet,
            totalQuestions: totalQuestionsHint || Math.max(...[...answeredSet, 0])
        };
    }

    // ===== 차트 빌더 =====
    function buildBarChart(ctx, labels, dataSec, highlightIndex = null) {
        if (window.barChartInstance) window.barChartInstance.destroy();
        const bg = dataSec.map((_, i) => (i === highlightIndex ? '#5872FF' : '#DDE2EB'));
        window.barChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: '응답 시간(초)',
                    data: dataSec,
                    backgroundColor: bg,
                    borderRadius: 12,
                    barPercentage: 0.6
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 10, color: '#B0B4BC', font: { size: 13 } }, grid: { color: '#F2F3F5' } },
                    x: { ticks: { color: '#B0B4BC', font: { size: 13 } }, grid: { display: false } }
                }
            }
        });
    }

    function buildDonutChart(ctx, progress01) {
        if (window.donutChartInstance) window.donutChartInstance.destroy();
        const pct = Math.max(0, Math.min(1, progress01));
        window.donutChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['진행', '남은'],
                datasets: [{
                    data: [Math.round(pct * 100), Math.round((1 - pct) * 100)],
                    backgroundColor: ['#5872FF', '#F2F3F5'],
                    borderWidth: 0
                }]
            },
            options: { cutout: '75%', plugins: { legend: { display: false } }, responsive: false }
        });
    }

    // ===== 키워드 클라우드 =====
    function buildKeywordCloud(el, interviewLog, maxWords = 20) {
        el.innerHTML = '';
        const text = interviewLog.map(r => `${r.userMessage || ''} ${r.botAnswer || ''}`).join(' ');
        const tokens = simpleTokenizeKorean(text);
        const countMap = new Map();
        for (const t of tokens) countMap.set(t, (countMap.get(t) || 0) + 1);
        const words = Array.from(countMap, ([text, count]) => ({ text, count }))
            .sort(byCountDesc).slice(0, maxWords)
            .map(w => ({ text: w.text, size: Math.max(10, 10 + w.count * 2) }));

        const w = 180, h = 80;
        const svg = d3.select(el).append('svg').attr('width', w).attr('height', h);
        d3.layout.cloud().size([w, h])
            .words(words).padding(1).rotate(() => 0)
            .font('Pretendard Variable')
            .fontSize(d => d.size)
            .on('end', (drawWords) => {
                svg.append('g')
                    .attr('transform', `translate(${w / 2},${h / 2})`)
                    .selectAll('text')
                    .data(drawWords)
                    .enter().append('text')
                    .style('font-size', d => d.size + 'px')
                    .style('fill', (d, i) => i === 0 ? '#5872FF' : '#B0B4BC')
                    .style('font-family', 'Pretendard Variable')
                    .attr('text-anchor', 'middle')
                    .attr('transform', d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
                    .text(d => d.text);
            })
            .start();
    }

    // ===== 퍼소나 UI 동기화 =====
    function syncPersonaUI(personaResults, selectedPersona) {
        // 상단 프로필 바
        const info = document.querySelector('.analyze-profile-info');
        const tags = document.querySelector('.analyze-profile-tags');
        if (info && selectedPersona) {
            info.innerHTML = `
                    <span class="profile-name">${selectedPersona.name || '-'}<\/span>
                    <span class="profile-age">${selectedPersona.age ? `${selectedPersona.age}세` : '-'}<\/span>
                    <span class="profile-gender">${selectedPersona.gender || '-'}<\/span>
                    <span class="profile-type">${selectedPersona.personality?.split(',')[0] || '-'}<\/span>
                `;
        }
        if (tags && selectedPersona) {
            const tagList = []
                .concat(selectedPersona.occupation || '')
                .concat(selectedPersona.interests || '')
                .concat(selectedPersona.hobby || '')
                .filter(Boolean)
                .slice(0, 4);
            tags.innerHTML = tagList.map(t => `<span>${String(t).trim()}<\/span>`).join('');
        }

        // 탭
        const tabsWrap = document.querySelector('.analyze-persona-tabs');
        if (tabsWrap && Array.isArray(personaResults) && personaResults.length) {
            tabsWrap.innerHTML = personaResults.map((p, i) =>
                `<button class="persona-tab ${selectedPersona === personaResults[i] ? 'active' : ''}" data-idx="${i}">${'퍼소나' + (i + 1)}<\/button>`
            ).join('');
            tabsWrap.querySelectorAll('.persona-tab').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = Number(btn.dataset.idx);
                    window.selectPersona(idx); // 이미 구현되어 있음
                    // 분석 페이지에 있을 수도 있으니 즉시 반영
                    syncPersonaUI(personaResults, personaResults[idx]);
                });
            });
        }
    }

    // ===== 분석 대시보드 렌더링 =====
    function renderAnalysisDashboard(options = {}) {
        // 옵션: 목표시간(분) 기본 20분, 하이라이트할 질문 인덱스 등
        const {
            targetMinutes = 20,
            highlightQuestionIndex = null
        } = options;

        // 0) 가드
        const analyzePage = document.getElementById('analyze-page');
        if (!analyzePage) return;

        // 1) 퍼소나 UI 반영
        syncPersonaUI(personaResults || [], selectedPersona || null);

        // 2) 인터뷰 로그 파생치
        const totalQuestionsHint = (Array.isArray(questions) ? questions.length : null);
        const M = deriveInterviewMetrics(interviewLog || [], totalQuestionsHint);

        // 3) Bar 차트
        const barCanvas = document.getElementById('barChart');
        if (barCanvas) {
            const barCtx = barCanvas.getContext('2d');
            buildBarChart(
                barCtx,
                M.labels.length ? M.labels : ['-'],
                M.durationsSec.length ? M.durationsSec : [0],
                (highlightQuestionIndex == null ? null : M.labels.findIndex(l => l === `Q${highlightQuestionIndex}`))
            );
        }

        // 4) 도넛(진행률) = 실제 경과 / 목표시간
        const donutCanvas = document.getElementById('donutChart');
        const donutPercentEl = document.getElementById('donutPercent');
        const donutTimeEl = document.getElementById('donutTime');

        const elapsed = M.totalMs; // 실제 경과시간
        const targetMs = Math.max(1, targetMinutes * 60 * 1000);
        const progress01 = elapsed / targetMs;

        if (donutCanvas) {
            const donutCtx = donutCanvas.getContext('2d');
            buildDonutChart(donutCtx, progress01);
        }
        if (donutPercentEl) donutPercentEl.textContent = `${Math.min(100, Math.round(progress01 * 100))}%`;
        if (donutTimeEl) donutTimeEl.textContent = `${msToMinSec(elapsed)} / ${msToMinSec(targetMs)}`;

        // 5) 키워드 클라우드
        const cloudEl = document.getElementById('keywordCloud');
        if (cloudEl) buildKeywordCloud(cloudEl, interviewLog || []);

        // 6) 속도/언어습관은 간단한 휴리스틱으로 업데이트
        //    - 평균 답변 길이(문자수) 기반으로 속도 감(placeholder)
        const avgChars = (interviewLog || []).length
            ? sum((interviewLog || []).map(r => (r.botAnswer || '').length)) / (interviewLog || []).length
            : 0;
        const speedPct = Math.max(20, Math.min(120, Math.round(avgChars / 80 * 100))); // 대략적 척도
        const speedBar = document.getElementById('speedBar');
        const speedLabel = document.querySelector('.speed-label');
        if (speedBar) speedBar.style.width = `${speedPct}%`;
        if (speedLabel) speedLabel.textContent = `${speedPct}% ${speedPct > 90 ? '조금 빨랐어요' : (speedPct < 50 ? '다소 느렸어요' : '적당했어요')}`;

        // 7) 언어습관 피드백(간단 규칙)
        const langFeedbackList = document.getElementById('langFeedbackList');
        if (langFeedbackList) {
            const ums = (interviewLog || []).filter(r => (r.userMessage || '').includes('음') || (r.userMessage || '').includes('어')).length;
            const longQ = (interviewLog || []).filter(r => (r.userMessage || '').length > 60).length;
            const tips = [];
            if (ums > 2) tips.push('발화 중 군더더기(음/어) 사용 빈도가 높습니다. 질문 전에 한 박자 쉬고 말해보세요.');
            if (longQ > 1) tips.push('질문이 너무 길어졌습니다. 한 문장 안에서 핵심을 먼저 던지고, 후속 질문으로 쪼개세요.');
            if (!tips.length) tips.push('전체적으로 안정적인 톤이었습니다. 후속 질문을 통해 더 깊이 파고드는 연습을 해보세요.');
            langFeedbackList.innerHTML = tips.map(t => `<li>${t}</li>`).join('');
        }

        // 8) 인터뷰 요약(GPT) – 기존 함수 fetchSummary()를 그대로 재사용
        //    interviewLog가 비어있으면 호출 안 함
        if ((interviewLog || []).length > 0) {
            // 기존 fetchSummary는 내부에서 summaryText를 업데이트함
            // 여기서 중복 호출 방지하고 싶다면 플래그로 제어하세요.
            // fetchSummary();  // 이미 파일에 있음. 그대로 사용하려면 주석 해제.
        }

        // 9) 친밀도 스텝(간단 규칙: 시간이 흐를수록 1→2→3)
        const steps = document.querySelectorAll('.affinity-step');
        if (steps && steps.length) {
            const stage = progress01 < 0.33 ? 0 : (progress01 < 0.66 ? 1 : 2);
            steps.forEach((el, i) => el.classList.toggle('active', i === stage));
        }
    }
    const questionNumSpan = document.getElementById("count");
    const decreaseBtn = document.getElementById("decrease-btn");
    const increaseBtn = document.getElementById("increase-btn");
    const interviewTitleInput = document.getElementById("interviewTitle");
    const interviewFor = document.getElementById("interviewFor");
    const callQuestionGPT = document.getElementById("generate-btn");
    const resultContainer = document.getElementById("question-container");
    const apiKeyModal = document.getElementById("apiKeyModal");
    const apiKeyInput = document.getElementById("apiKeyInput");
    const saveApiKeyBtn = document.getElementById("saveApiKey");
    const changeApiKeyBtn = document.getElementById("changeApiKey");

    let questionNum = 8; // 기본 질문 개수
    let apiKey = localStorage.getItem("openai_api_key") || "";

    // 퍼소나 생성 관련 요소
    const personaBox = document.getElementById("persona-side");
    const personaContainer = document.getElementById("persona-container")
    const personaDecreaseBtn = document.getElementById("persona-decrease-btn");
    const personaIncreaseBtn = document.getElementById("persona-increase-btn");
    const personaCountSpan = document.getElementById("persona-count");
    const callPersonaGPT = document.getElementById("persona-generate-btn");

    let personaNum = 3; // 초기값

    let lastIndex = 0; // 현재까지의 interviewIndex 상태 기억용

    // === 퍼소나 세션 상태 ===
    let personaState = {
        name: null, age: null, gender: null, occupation: null,
        personality: null, speech: null,
        goal: "사용 경험의 불편·욕구를 구체 사례로 끌어내기",
        subgoals: [
            "표면적 긍정 아래 숨은 불만 포착",
            "사례/빈도/맥락(언제, 어디서, 왜)을 구체화",
            "수치·비교(전/후, A/B)로 재진술"
        ],
        stance: "협조적이지만 솔직함을 우선",
        mood: "중립",
        lastTopic: null,
        lastCounterAskedAtIdx: 0,
        followupsOnCurrent: 0
    };

    function initPersonaStateFrom(selected) {
        if (!selected) return;
        personaState.name = selected.name || null;
        personaState.age = selected.age || null;
        personaState.gender = selected.gender || null;
        personaState.occupation = selected.occupation || null;
        personaState.personality = selected.personality || null;
        personaState.speech = selected.speech || null;
        personaState.mood = "중립";
        personaState.lastTopic = null;
        personaState.lastCounterAskedAtIdx = 0;
        personaState.followupsOnCurrent = 0;
    }

    // === phase/intent 감지 ===
    const GREET_REGEX = /(안녕|안녕하세요|처음|반갑|만나서)/i;
    const SMALLTALK_REGEX = /(날씨|주말|요즘|점심|커피|출근|취미|취향|근황)/i;
    function detectPhase({ lastIndex, turnCount, userText }) {
        // 0: icebreaking/greeting, 1: smalltalk, 2: core
        if (turnCount <= 2 || GREET_REGEX.test(userText)) return 0;
        if (lastIndex === 0 || SMALLTALK_REGEX.test(userText)) return 1;
        return 2;
    }

    // 안전한 JSON 파싱 도우미
    function safeParseJSON(s) {
        try { return JSON.parse(s); } catch (e) { }
        const m = s && s.match(/\{[\s\S]*\}/);
        if (m) { try { return JSON.parse(m[0]); } catch (e) { } }
        return null;
    }

    // 저렴한 모델로부터 스타일 힌트를 JSON으로 받기
    async function getStyleHintsLLM(apiKey, { personaState, userMessage, phase, predictedIndex, questions }) {
        const baseHints = {
            tone: "neutral",
            allow_micro_openers: [],
            use_short_episode: false,
            sentence_target: "2-3",
            followup: { should_ask: false, template: "" }
        };

        const prompt = `\n당신은 인터뷰 톤 코치입니다. 아래 정보를 보고 '스타일 힌트'를 JSON으로만 반환하세요.\n\n[퍼소나]\n이름: ${personaState?.name ?? "-"}\n나이/성별/직업: ${personaState?.age ?? "-"} / ${personaState?.gender ?? "-"} / ${personaState?.occupation ?? "-"}\n성격: ${personaState?.personality ?? "-"}\n\n[대화 단계] ${phase}  (0=아이스브레이킹, 1=잡담, 2=본론)\n[현재 질문 번호 후보] ${predictedIndex}\n[사용자 발화] """${(userMessage || "").slice(0, 500)}"""\n[질문 목록 샘플] ${Array.isArray(questions) ? questions.slice(0, 6).join(" / ") : "-"}\n\n원칙:\n- JSON 이외 출력 금지.\n- 키: tone(“casual|neutral|analytical|warm|blunt” 중 택1), allow_micro_openers(array, optional, 아주 짧은 접속부 추천), use_short_episode(boolean), sentence_target("2-3"|"3-4"), followup:{should_ask:boolean, template:string}\n- phase<=1이면 allow_micro_openers는 0~2개 가볍게, use_short_episode=false 권장.\n- phase=2면 tone은 성격을 반영하되 과도한 형식화 금지, sentence_target은 2-3 또는 3-4.\n- followup.should_ask는 정말 필요할 때만 true.\n`;

        try {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.6,
                    max_tokens: 300
                })
            });
            const data = await res.json();
            const parsed = safeParseJSON(data?.choices?.[0]?.message?.content || "");
            if (!parsed) return baseHints;
            return {
                tone: parsed.tone || baseHints.tone,
                allow_micro_openers: Array.isArray(parsed.allow_micro_openers) ? parsed.allow_micro_openers.slice(0, 3) : [],
                use_short_episode: !!parsed.use_short_episode,
                sentence_target: parsed.sentence_target || baseHints.sentence_target,
                followup: { should_ask: !!(parsed.followup && parsed.followup.should_ask), template: (parsed.followup && parsed.followup.template) || "" }
            };
        } catch (e) {
            return baseHints;
        }
    }
    // New: build system prompt that injects style hints but does NOT force string concatenation
    function buildSystemPrompt(interviewTitle, questions, predictedIndex, phase, personaState, styleHints) {
        const qref = Array.isArray(questions) ? questions.join(', ') : '';
        const openers = (styleHints?.allow_micro_openers || []).join(" / ");

        return `\n당신은 인터뷰 대상 퍼소나입니다. 자연스러운 구어체로 답변하세요.\n\n[역할] ${personaState.name} (${personaState.age}세, ${personaState.gender}, ${personaState.occupation})\n[성격] ${personaState.personality || "평범"}\n[언어습관] ${personaState.speech || "자연스러운 구어체"}\n[대화 단계] ${phase} (0=아이스브레이킹, 1=잡담, 2=본론)\n[현재 질문 번호 후보] ${predictedIndex}\n[인터뷰 주제] ${interviewTitle}\n[질문 목록(참고)] ${qref}\n\n[스타일 힌트]\n- tone: ${styleHints.tone}\n- sentence_target: ${styleHints.sentence_target}문장\n- optional micro-openers (예시): ${openers || "(없음)"}\n- short episode 허용: ${styleHints.use_short_episode ? "가능" : "지양"}\n- follow-up 권고: ${styleHints.followup?.should_ask ? `가능 (예: "${styleHints.followup.template.slice(0, 50)}...")` : "지양"}\n\n[원칙]\n- 위 예시 표현을 그대로 복사하지 말고, 맥락상 자연스러우면 의미상 유사하게 의역해서 사용합니다. 어울리지 않으면 사용하지 않습니다.\n- 아이스브레이킹/잡담(phase<=1)에서는 가볍고 짧게. 본론(phase=2)에서만 필요 시 간단한 사례 1개를 덧붙입니다.\n- 이모지·표·메타발화(\"AI로서…\") 금지.\n- 한 번의 응답에서 문장 수는 ${styleHints.sentence_target}문장 정도로 유지.\n- follow-up 필요 시 한 문장짜리 짧은 질문을 맨 끝에 1개만 덧붙이되, 맥락이 맞을 때만 사용합니다.\n`.trim();
    }

    // New: generate core answer via FT model (no client-side concatenation)
    async function generateCoreAnswer(apiKey, systemPrompt, userMessage, { phase }) {
        const payload = {
            model: modelId, // fine-tuned model id
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            temperature: (phase <= 1 ? 0.7 : 0.9),
            max_tokens: (phase <= 1 ? 220 : 420),
            top_p: 1,
            frequency_penalty: 0.15,
            presence_penalty: 0.1
        };
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "gen error");
        return (data.choices?.[0]?.message?.content || "").trim();
    }

    // === 분석용 추가 유틸 ===
    function approxTokenCount(text) { if (!text) return 0; return Math.ceil(text.length / 3); }
    const FILLER_REGEX = /(\b|\s)(음+|어+|그+|그러니까|그런데|뭐랄까)(?=\b|\s)/g;
    function countFillers(text) { if (!text) return 0; const m = text.match(FILLER_REGEX); return m ? m.length : 0; }
    function buildAnalysis(log, targetMinutes = 20) {
        if (!Array.isArray(log) || !log.length) return null;
        const first = Math.min(...log.map(r => r.timestampStart || Infinity));
        const last = Math.max(...log.map(r => r.timestampEnd || -Infinity));
        const elapsedMs = (isFinite(first) && isFinite(last) && last >= first) ? last - first : 0;
        const targetMs = targetMinutes * 60000;
        const turns = log.length; // each entry is one user->bot pair
        // perQuestion stats
        const map = new Map();
        log.forEach(r => { const idx = r.questionIndex || 0; const dur = (r.timestampEnd || 0) - (r.timestampStart || 0); if (!map.has(idx)) map.set(idx, { index: idx, durations: [], count: 0 }); const o = map.get(idx); o.durations.push(Math.max(0, dur)); o.count++; });
        const perQuestion = [...map.values()].sort((a, b) => a.index - b.index).map(o => ({ index: o.index, meanMs: o.durations.length ? (o.durations.reduce((a, b) => a + b, 0) / o.durations.length) : 0, count: o.count }));
        // strategy (followups)
        const followups = perQuestion.filter(p => p.index > 0).map(p => ({ index: p.index, count: Math.max(0, p.count - 1) }));
        const addedCount = followups.reduce((a, b) => a + b.count, 0);
        const totalQ = followups.length || 1;
        // speaking ratio
        const totalUserChars = log.reduce((a, b) => a + (b.userChars || 0), 0);
        const totalBotChars = log.reduce((a, b) => a + (b.botChars || 0), 0);
        const charsPerSec = 6.5;
        const userSec = totalUserChars / charsPerSec;
        const botSec = totalBotChars / charsPerSec;
        const speakingTotal = userSec + botSec || 1;
        // language habits
        const totalFillers = log.reduce((a, b) => a + (b.userFillerCount || 0), 0);
        const fillersPerMin = elapsedMs ? (totalFillers / (elapsedMs / 60000)) : 0;
        const longThreshold = 60;
        const longQuestionRatio = log.filter(r => (r.userMessage || '').length > longThreshold).length / log.length;
        // simple repetition score: repeated bigrams ratio
        const bigramCount = new Map();
        log.forEach(r => { const t = (r.userMessage || '').replace(/\s+/g, ' ').trim().split(' '); for (let i = 0; i < t.length - 1; i++) { const bg = t[i] + "|" + t[i + 1]; bigramCount.set(bg, (bigramCount.get(bg) || 0) + 1); } });
        let repeatPairs = 0, totalPairs = 0; bigramCount.forEach(v => { if (v > 1) repeatPairs += v; totalPairs += v; });
        const repetitionScore = totalPairs ? repeatPairs / totalPairs : 0;
        // emotion placeholder
        const emotionDist = {}; const emotionKeys = ['neutral', 'joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'other']; emotionKeys.forEach(k => emotionDist[k] = 0);
        log.forEach(r => { const e = r.userEmotion || 'neutral'; if (emotionDist[e] !== undefined) emotionDist[e] += 1; });
        const totalEmotion = Object.values(emotionDist).reduce((a, b) => a + b, 0) || 1; Object.keys(emotionDist).forEach(k => emotionDist[k] = emotionDist[k] / totalEmotion);
        const responded = 0; // placeholder until emotion response eval implemented
        const keywords = extractTopKeywords(log);
        return {
            meta: { elapsedMs, targetMs, progress01: targetMs ? elapsedMs / targetMs : 0, turns },
            perQuestion,
            keywords, // top-N 키워드
            strategy: { additionalRatio: addedCount / totalQ, followups: followups.filter(f => f.count > 0) },
            interaction: { turnTaking: turns, speakingRatio: { user: userSec / speakingTotal, bot: botSec / speakingTotal }, wpm: { user: elapsedMs ? (totalUserChars / (elapsedMs / 60000) / 2.5) : 0, bot: elapsedMs ? (totalBotChars / (elapsedMs / 60000) / 2.5) : 0 } },
            emotion: { userDist: emotionDist, responded },
            languageHabits: { fillersPerMin, longQuestionRatio, repetitionScore }
        };
    }
    let latestAnalysis = null;

    function extractTopKeywords(logs, topN = 12) {
        if (!Array.isArray(logs) || !logs.length) return [];
        const txt = logs.map(r => `${r.userMessage || ''} ${r.botAnswer || ''}`).join(' ');
        const tokens = simpleTokenizeKorean(txt);
        const map = new Map();
        for (const t of tokens) map.set(t, (map.get(t) || 0) + 1);
        return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([text, count]) => ({ text, weight: count }));
    }

    //로딩스피너
    function showSpinner() {
        document.getElementById("loadingSpinner").style.display = "block";
    }

    function hideSpinner() {
        document.getElementById("loadingSpinner").style.display = "none";
    }

    // 페이지 로드 시 API 키 입력 모달 표시
    if (!apiKey) {
        apiKeyModal.style.display = "block";
    }

    // API 키 저장 버튼
    saveApiKeyBtn.addEventListener("click", () => {
        const enteredKey = apiKeyInput.value.trim();
        if (enteredKey) {
            apiKey = enteredKey;
            localStorage.setItem("openai_api_key", apiKey);
            apiKeyModal.style.display = "none";
        } else {
            alert("API 키를 입력해주세요!");
        }
    });

    // API 키 변경 버튼
    changeApiKeyBtn.addEventListener("click", () => {
        apiKeyModal.style.display = "block";
    });

    // 질문 개수 조절
    decreaseBtn.addEventListener("click", () => {
        if (questionNum > 4) {
            questionNum--;
            questionNumSpan.textContent = questionNum;
        }
    });

    increaseBtn.addEventListener("click", () => {
        if (questionNum < 16) {
            questionNum++;
            questionNumSpan.textContent = questionNum;
        }
    });

    // 퍼소나 개수 조절
    personaDecreaseBtn.addEventListener("click", () => {
        if (personaNum > 1) {
            personaNum--;
            personaCountSpan.textContent = personaNum;
            removePersonaBox(); // 마지막 퍼소나 입력 필드 삭제
        }
    });

    personaIncreaseBtn.addEventListener("click", () => {
        if (personaNum < 5) {
            personaNum++;
            personaCountSpan.textContent = personaNum;
            addPersonaBox(); // 새로운 퍼소나 입력 필드 추가
        }
    });

    function getPersonaPrompts() {
        let prompts = [];

        for (let i = 1; i <= personaNum; i++) {
            const inputField = document.getElementById(`promptForPersona${i}`);
            if (inputField) {
                const promptText = inputField.value.trim();
                prompts.push(promptText);
            } else {
                prompts.push(""); // 입력란이 없을 경우 빈 문자열 추가
            }
        }

        return prompts;
    }

    function addPersonaBox() {
        const personaPromptBox = document.createElement("div");
        personaPromptBox.classList.add("persona-prompt-box");

        const label = document.createElement("label");
        label.setAttribute("for", `promptForPersona${personaNum}`);
        label.textContent = `퍼소나${personaNum}`;

        const input = document.createElement("input");
        input.setAttribute("type", "text");
        input.setAttribute("id", `promptForPersona${personaNum}`);
        input.setAttribute("placeholder", "원하는 설정을 상세히 적어주세요");

        personaPromptBox.appendChild(label);
        personaPromptBox.appendChild(input);

        personaBox.appendChild(personaPromptBox);
    }

    function removePersonaBox() {
        const personaPromptBoxes = document.querySelectorAll(".persona-prompt-box");
        if (personaPromptBoxes.length > 0) {
            personaBox.removeChild(personaPromptBoxes[personaPromptBoxes.length - 1]); // 마지막 요소 삭제
        }
    }

    let questions;

    // GPT API 호출 (인터뷰 질문 생성)
    callQuestionGPT.addEventListener("click", async () => {
        showSpinner();

        const interviewTitle = interviewTitleInput.value.trim();
        const interviewPurpose = interviewFor.value.trim();

        if (!apiKey || !interviewTitle || !interviewPurpose) {
            alert("필수 항목을 입력해주세요!");
            hideSpinner();
            return;
        }

        const payload = {
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: [{ text: `${interviewTitle}를 주제로 한 인터뷰는 ${interviewFor}을 목적으로 해야합니다. 이 인터뷰에서 해야하는는 질문을 ${questionNum}개 생성합니다. 인터뷰 질문은 인터뷰 순서에 맞게 구성되어야 하며, 개수는 user의 프롬프트에 기반합니다. 첫 질문은 인터뷰 주제에 대한 간단한 질문으로 시작합니다. 2번째 질문부터 본격적으로 목적에 맞게 질문을 작성하는데, 목적을 그대로 해석하지 말고, 목적으로부터 파생되는 심층적인 인사이트에 집중한 질문 생성을 기대합니다. 다음과 같은 이름을 부여한 인덱스로 내용을 채워 json 배열 타입으로 출력합니다. 이 양식 이외의 내용은 출력금지. json 형태로 출력하며, \n질문1\n질문2\n...\n이때, 숫자, 질문 인덱스 표시는 하지 않고, 텍스트만 큰 따옴표로 묶어서 넣고, 콤마를 삽입합니다. 그 밖의 내용은 절대 출력 금지. 개수를 정확히 준수합니다.`, type: "text" }] }],
            temperature: 0.75,
            max_tokens: 2048,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0
        };

        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.choices && data.choices.length > 0) {
                questions = JSON.parse(data.choices[0].message.content);
                resultContainer.innerHTML = questions.map(q => `<p>${q}</p>`).join("");

                const questionListEl = document.getElementById("questionList");
                if (questionListEl) {
                    questionListEl.innerHTML = questions.map((q, i) => `<li>${i + 1}. ${q}</li>`).join("");
                }
                // 질문 생성 성공 뒤 임베딩 준비
                await ensureQuestionEmbeddings(apiKey, questions);
            } else {
                resultContainer.innerHTML = "<p>질문 생성 실패</p>";
            }
        } catch (error) {
            console.error(error);
            resultContainer.innerHTML = "<p>에러 발생</p>";
        } finally {
            hideSpinner();
        }
    });


    let personaResults = [];

    // GPT API 호출 (퍼소나 생성)
    callPersonaGPT.addEventListener("click", async () => {
        const interviewTitle = interviewTitleInput.value.trim();
        const isSimpleMode = document.getElementById("toggle").checked;
        let personaPrompts = isSimpleMode ? [] : getPersonaPrompts();

        if (!apiKey) {
            alert("API 키를 입력해야 합니다!");
            return;
        }

        if (!interviewTitle) {
            alert("인터뷰 주제를 입력해주세요!");
            return;
        }

        resultContainer.innerHTML = "<p>퍼소나를 생성 중입니다...</p>";
        showSpinner();
        personaResults = [];

        try {
            for (let i = 0; i < personaNum; i++) {
                const promptText = personaPrompts[i] || "";

                const payload = {
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: [
                                {
                                    text: `인터뷰에서 사용할 ${i + 1}번째 퍼소나를 생성해주세요. 인터뷰 주제는 '${interviewTitle}'입니다. '${promptText ? `이 퍼소나는 반드시 ${promptText}를 기반으로 만들어야 하며, 지정된 내용의 누락이 없어야 합니다.` : ""}' 퍼소나는 현실적인 직업, 연령, 성격, 관심사를 가지고 있어야 하며, 인터뷰에서 논의될 주제와 관련성이 있어야 합니다. \n이 양식으로 출력합니다:\n{\n"name": "퍼소나 성명",\n "gender": "퍼소나 성별", \n"age": "연령",\n"occupation": "직업",\n"personality": "성격",\n"interests": "관심사",\n"hobby": "취미",\n"speech": "언어습관",}\n그 밖의 내용은 출력하지 마세요. JSON 형식만 반환하세요. 이름은 성별에 맞추고, 반드시 한국식 3글자 이름으로 작성합니다. 직업은 '소속 부서 직급'순으로 기입하며, 예를 들어, '삼성증권 영업부 대리', '경원상사 재경부 부장' 입니다. 또는 프리랜서, 무직, 학생같은 형태도 상관 없습니다. \n 만약 지금 만드는 퍼소나가 3번째라면, 성격은 '매우 비관적', '공격적이고 꼬장꼬장함', '성질이 더럽고 짜증이 많음', '매우 소심하고 내성적' 등 과 같이 사회성이 매우 떨어지는 형태로 작성합니다. 3번째가 아닌 퍼소나는 평범하고 사회성 있는 성격으로 작성 합니다. \n 언어습관은 퍼소나의 말하기 방식을 정하는 것이며, 딱딱함/여유로움움, 내성적/외향적, 의기소침/자신감, 공격적/방어적, 단답형/장문형, 논리적/단편형에서, 각 선택지 한개씩 전부 반드시 골라야 함. 3의 배수 퍼소나라면 그에 맞춰 이야기 하기 까다로운 사용자를 만듭니다. \n 출력방식 json 타입을 꼭 지키도록 하며, {}괄호 전후로 아무것도 입력금지.`,
                                    type: "text"
                                }
                            ]
                        }
                    ],
                    temperature: 0.9,
                    max_tokens: 1024,
                    top_p: 1,
                    frequency_penalty: 0,
                    presence_penalty: 0
                };

                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (data.choices && data.choices.length > 0) {
                    const persona = JSON.parse(data.choices[0].message.content);
                    personaResults.push(persona);
                }
            }
        } catch (error) {
            console.error("퍼소나 생성 중 오류:", error);
            resultContainer.innerHTML = "<p>퍼소나 생성 중 오류가 발생했습니다.</p>";
        } finally {
            hideSpinner();
        }

        personaContainer.innerHTML = personaResults.map((p, index) => `
            <div class="persona-box" id="persona-${index}" onclick="selectPersona(${index})">
                <p><strong>이름:</strong> ${p.name}</p>
                <p><strong>연령:</strong> ${p.age}</p>
                <p><strong>직업:</strong> ${p.occupation}</p>
                <p><strong>성격:</strong> ${p.personality}</p>
                <p><strong>관심사:</strong> ${p.interests}</p>
                <p><strong>언어습관:</strong> ${p.speech}</p>
                <button onclick="selectPersona(${index})">이 퍼소나 선택</button>
            </div>
        `).join("");
    });



    window.selectPersona = function (index) { // window 객체에 함수 등록하여 HTML에서 접근 가능하도록 함
        selectedPersona = personaResults[index]; // 선택한 퍼소나 저장
        initPersonaStateFrom(selectedPersona);

        alert(`${selectedPersona.name} 퍼소나를 선택하였습니다.`);
        if (personaResults.length === 0) {
            alert("퍼소나 데이터가 없습니다.");
            return;
        }

        // 인터뷰 페이지로 이동
        document.getElementById("persona-page").style.display = "none";
        document.getElementById("interview-page").style.display = "block";

        // 인터뷰 시작 시 초기 메시지 출력
        document.getElementById("chatbox").innerHTML = `
        <div><strong>인터뷰 대상:</strong> ${selectedPersona.name} (${selectedPersona.occupation})</div>
        <div><strong>성격:</strong> ${selectedPersona.personality}</div>
    `;
    };



    //아래는 음성처리부분/////////////////////////////////////////////////////////////////////////////////////////////////////////

    const apiUrl = "https://api.openai.com/v1/chat/completions";
    const modelId = "ft:gpt-4o-2024-08-06:chamkkae:chamkkae-v3a:AmwkrRHc";

    const chatbox = document.getElementById('chatbox');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const micButton = document.getElementById('micButton'); // 음성 입력 버튼
    const micStatus = document.getElementById('micStatus'); // 음성 인식 상태 표시용(추가 필요)

    const audioElement = new Audio(); // 오디오 재생을 위한 HTMLAudioElement

    // 음성 인식 자동화 (Web Speech API)
    const speechRecognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    speechRecognition.lang = 'ko-KR';
    speechRecognition.interimResults = false;
    speechRecognition.continuous = false;

    let isListening = false;
    let isSpeaking = false;
    let isPending = false;

    function updateMicStatus(status) {
        if (micStatus) micStatus.textContent = status;
        if (micButton) {
            if (status === '듣는 중') {
                micButton.classList.add('active');
            } else {
                micButton.classList.remove('active');
            }
        }
    }

    function safeStartRecognition() {
        try {
            speechRecognition.start();
        } catch (e) { }
    }

    speechRecognition.onstart = function () {
        isListening = true;
        updateMicStatus('듣는 중');
    };
    speechRecognition.onend = function () {
        isListening = false;
        updateMicStatus('대기');
        if (!isSpeaking && !isPending) {
            setTimeout(safeStartRecognition, 250);
        }
    };
    speechRecognition.onerror = function (event) {
        isListening = false;
        updateMicStatus('에러');
        const nonFatal = ['no-speech', 'audio-capture', 'not-allowed', 'aborted'];
        if (!isSpeaking && !isPending && !nonFatal.includes(event.error)) {
            setTimeout(safeStartRecognition, 600);
        }
    };
    speechRecognition.onresult = function (event) {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) {
                finalTranscript += res[0].transcript;
            }
        }
        if (finalTranscript) {
            userInput.value = finalTranscript;
            sendMessage(finalTranscript, true); // 음성 입력 자동 전송
        }
    };

    // 페이지 진입 시 자동 음성 인식 시작
    setTimeout(safeStartRecognition, 500);

    // function extractCurlyBracesContent(text) {
    //     const match = text.match(/\{.*?\}/);
    //     return match ? match[0] : null;  // 괄호 포함된 부분 반환, 없으면 null
    // }
    // const exampleText = "퍼소나 json 답변의 변수명을 여기로 넣으씨오";
    // const extracted = extractCurlyBracesContent(exampleText);

    // console.log(extracted); // "{내용:내용}"

    let messages = [
        {
            role: "system",
            content:
                `위 정보를 바탕으로, 사용자가 제출한 자료에 맞는 가상의 인물로 연기해주세요. ` +
                `대화는 반드시 대화체로, 불필요한 표, 단락, 기호, 이모지 없이 진행해 주세요.`
        }
    ];

    let socket;

    function connectWebSocket() {
        socket = new WebSocket("ws://localhost:5501/ws");

        socket.onopen = () => {
            console.log("문이 열리고 멋진 그대가 들어오네요우.");
        };

        socket.onmessage = async (event) => {
            try {
                const audioBlob = new Blob([event.data], { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                audioElement.src = audioUrl;
                audioElement.play();
                console.log(`이전에 입력된 시스템 프롬프트는? [${messages[0].content}]`)
            } catch (error) {
                console.error("Error processing WebSocket message:", error);
            }
        };

        socket.onclose = (event) => {
            console.warn("WebSocket connection closed:", event.code);
        };

        socket.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
    }

    let lastHighlightedIndex = null;

    function highlightCurrentQuestion(index) {
        const questionItems = document.querySelectorAll('#questionList li');

        // 아이스브레이킹 단계면 모든 하이라이트 제거
        if (index === 0) {
            questionItems.forEach(item => {
                item.classList.remove('active-question');
            });
            lastHighlightedIndex = null;
            return;
        }

        // 1번 질문부터는 하이라이트
        const realIndex = index - 1;

        if (lastHighlightedIndex === realIndex) return;

        questionItems.forEach((item, i) => {
            item.classList.toggle('active-question', i === realIndex);
        });

        lastHighlightedIndex = realIndex;
    }

    // function appendMessage(message, sender) {
    //     const messageElement = document.createElement('div');
    //     messageElement.className = `message ${sender}`;
    //     messageElement.textContent = message;
    //     chatbox.appendChild(messageElement);
    //     chatbox.scrollTop = chatbox.scrollHeight;
    // }
    function appendMessage(message, sender) {
        if (sender === 'bot') {
            const wrapper = document.createElement('div');
            wrapper.className = 'message-wrapper';

            const nameTag = document.createElement('div');
            nameTag.className = 'persona-name-tag';

            if (selectedPersona && selectedPersona.name) {
                nameTag.textContent = selectedPersona.name.slice(-2); // 성 제외, 두 글자
            } else {
                nameTag.textContent = "퍼소나"; // fallback
            }

            const messageElement = document.createElement('div');
            messageElement.className = 'message bot';
            messageElement.textContent = message;

            wrapper.appendChild(nameTag);
            wrapper.appendChild(messageElement);
            chatbox.appendChild(wrapper);

            wrapper.scrollIntoView({ behavior: "smooth", block: "start" });//스크롤 이동
        } else {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${sender}`;
            messageElement.textContent = message;
            chatbox.appendChild(messageElement);

            messageElement.scrollIntoView({ behavior: "smooth", block: "start" });//스크롤 이동
        }

        chatbox.scrollTop = chatbox.scrollHeight;
    }

    function appendStageMessage(text) {
        const divider = document.createElement('div');
        divider.className = "stage-message";
        divider.textContent = `--- ${text} ---`;
        divider.style.textAlign = "center";
        divider.style.color = "#999";
        divider.style.fontSize = "14px";
        divider.style.margin = "16px 0";
        chatbox.appendChild(divider);
    }


    // legacy 대화 기록 구조 병합
    let dataInterviewChatText = '';
    let dataInterviewChatIndex = 0;
    let dataInterviewArr = [
        {
            id: dataInterviewChatIndex,
            text: dataInterviewChatText,
            isUser: true,
            timestamp: new Date().toISOString()
        }
    ];
    let interviewLog = []; // 인터뷰 Q&A 기록용
    let sendStartTime = null;

    // 음성 인식 결과를 dataInterviewArr에 저장하는 함수 (legacy 병합)
    function saveSpeechResultToInterviewArr(finalTranscript) {
        if (!finalTranscript) return;
        dataInterviewChatText = finalTranscript;
        dataInterviewChatIndex++;
        dataInterviewArr.push({
            id: dataInterviewChatIndex,
            text: dataInterviewChatText,
            isUser: true,
            timestamp: new Date().toISOString()
        });
    }

    // sendMessage: 음성 입력 자동 전송 지원, persona 특성 기반 프롬프트/음성합성 지원
    async function sendMessage(voiceInput, isVoice) {
        const apiKey = apiKeyInput.value.trim();
        let userMessage = (typeof voiceInput === 'string') ? voiceInput : userInput.value.trim();
        if (!apiKey) { alert('API 키를 입력해주세요.'); return; }
        if (!userMessage) { alert('메시지를 입력해주세요.'); return; }
        if (!selectedPersona) { alert("먼저 퍼소나를 선택해주세요."); return; }

        // 1) 질문 인덱스 사전 분류
        let predicted = { index: Math.max(1, lastIndex || 1), score: 0, reason: "default" };
        try {
            predicted = await classifyQuestionIndex(userMessage, lastIndex || 0, questions || [], apiKey);
        } catch (e) { /* 임베딩 실패 시 무시하고 진행 */ }

        // 2) 하이라이트 & stage 메세지
        highlightCurrentQuestion(predicted.index);
        if (predicted.index === 1 && lastIndex === 0 && !chatbox.querySelector('.stage-message')) {
            appendStageMessage("인터뷰를 시작합니다");
        }
        lastIndex = predicted.index;

        // 3) 사용자 메시지 출력/기록
        saveSpeechResultToInterviewArr(userMessage);
        appendMessage(userMessage, 'user');
        if (!isVoice) userInput.value = '';

        // 4) phase 감지
        const interviewTitle = interviewTitleInput.value.trim();
        const turnCount = (interviewLog || []).length + 1; // 이번 턴 포함 카운트 근사
        const phase = detectPhase({ lastIndex: lastIndex, turnCount, userText: userMessage });

        // === (신규) 스타일 힌트 생성: 저렴한 모델 ===
        sendStartTime = Date.now();
        isPending = true; updateMicStatus('GPT 응답 대기');
        try {
            const styleHints = await getStyleHintsLLM(apiKey, {
                personaState, userMessage, phase, predictedIndex: predicted.index, questions
            });

            // === (신규) systemPrompt 생성: 힌트 주입, 강제 접붙이기 없음 ===
            const systemPrompt = buildSystemPrompt(
                interviewTitle, questions, predicted.index, phase, personaState, styleHints
            );

            // === (신규) 파인튜닝 모델로 최종 답변 생성 ===
            const coreAnswer = await generateCoreAnswer(apiKey, systemPrompt, userMessage, { phase });

            // 출력: 더 이상 클라이언트에서 버퍼/에피소드/역질문을 붙이지 않음
            const finalAnswer = coreAnswer;
            highlightCurrentQuestion(lastIndex);
            appendMessage(finalAnswer, 'bot');
            messages.push({ role: 'assistant', content: finalAnswer });
            const endTime = Date.now();
            const userChars = userMessage.length;
            const botChars = finalAnswer.length;
            const userFillerCount = countFillers(userMessage);
            interviewLog.push({
                questionIndex: lastIndex,
                question: (questions && questions[lastIndex - 1]) ? questions[lastIndex - 1] : "(파생 질문)",
                userMessage,
                botAnswer: finalAnswer,
                timestampStart: sendStartTime,
                timestampEnd: endTime,
                userChars,
                botChars,
                userTokens: approxTokenCount(userMessage),
                botTokens: approxTokenCount(finalAnswer),
                userFillerCount,
                userEmotion: null,
                botAcknowledged: null
            });

            // followup state 업데이트 (여전히 로컬 카운트만 유지)
            if (interviewLog.length >= 2 && interviewLog[interviewLog.length - 2].questionIndex === lastIndex) {
                personaState.followupsOnCurrent += 1;
            } else {
                personaState.followupsOnCurrent = 0;
            }
            personaState.lastTopic = extractTopicHint(userMessage) || personaState.lastTopic;

            // 음성합성 & 소켓
            await speakTextPersona(finalAnswer, selectedPersona);
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ apiKey, gptResponse: finalAnswer }));
            }
            isPending = false; updateMicStatus('듣는 중');
        } catch (error) {
            appendMessage(`Error: ${error.message}`, 'bot');
            isPending = false; updateMicStatus('대기');
        }
    }


    // 분석 결과 렌더링 함수
    window.renderAnalysis = function renderAnalysis() {
        const container = document.getElementById("analyze-container");
        if (!container) return;
        if (interviewLog.length === 0) {
            container.innerHTML = "<p>분석할 인터뷰 기록이 없습니다.</p>";
            return;
        }
        const avgDurations = interviewLog.map(log => ({
            index: log.questionIndex,
            durationSec: ((log.timestampEnd - log.timestampStart) / 1000).toFixed(1),
        }));
        const totalTime = avgDurations.reduce((acc, d) => acc + parseFloat(d.durationSec), 0);
        const avgTime = (totalTime / avgDurations.length).toFixed(1);
        container.innerHTML = `
            <h3>인터뷰 분석 요약</h3>
            <ul style="font-size:14px; line-height:1.6;">
                <li><strong>총 질문 수:</strong> ${interviewLog.length}개</li>
                <li><strong>평균 소요 시간:</strong> ${avgTime}초</li>
            </ul>
            <h4>질문별 응답 시간</h4>
            <canvas id="barChart" width="400" height="200"></canvas>
            <ul>
                ${avgDurations.map(d => `<li>Q${d.index}: ${d.durationSec}초</li>`).join("")}
            </ul>
        `;

        // barChart 캔버스가 DOM에 추가된 후 getContext 호출
        const ctx = document.getElementById('barChart').getContext('2d');
        const labels = avgDurations.map(d => `Q${d.index}`);
        const data = avgDurations.map(d => d.durationSec);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '질문별 응답 시간(초)',
                    data: data,
                    backgroundColor: '#4F8CFF'
                }]
            },
            options: {
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    // 분석 버튼 이벤트 리스너 예시 (분석 버튼/컨테이너가 없다면 HTML에 추가 필요)

    document.getElementById("endInterviewBtn").addEventListener("click", () => {
        document.getElementById("interview-page").style.display = "none";
        document.getElementById("analyze-page").style.display = "block";

        document.querySelector(".sub-interview").classList.add("sub-inactive");
        document.querySelector(".sub-analysis").classList.remove("sub-inactive");
        renderAnalysisDashboard({ targetMinutes: 20 });
    });


    // 분석페이지 진입 시 자동 렌더링 (탭 연동 시 아래 코드 위치 조정)
    // if (document.getElementById('analyze-page')) {
    //     renderAnalysisDashboard();
    // }

    document.getElementById("sendButton").addEventListener("click", () => sendMessage());
    document.getElementById("userInput").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();
        }
    });
    micButton.addEventListener("click", () => {
        if (!isListening) safeStartRecognition();
    });

    // 퍼소나 특성 기반 음성 합성 함수
    async function speakTextPersona(text, persona) {
        if (!text) return;
        isSpeaking = true;
        let voice = 'coral'; // 기본값
        if (persona && persona.gender) {
            const gender = String(persona.gender).trim();
            if (gender === '여자' || gender === '여성' || gender === 'female' || gender === 'woman') {
                voice = 'alloy';
            } else if (gender === '남자' || gender === '남성' || gender === 'male' || gender === 'man') {
                voice = 'echo';
            }
        }
        let instructions = '자연스럽고 친근한 톤으로 말해주세요.';
        if (persona && persona.speech) {
            instructions += ` ${persona.speech}`;
        }
        // 연령 기반 음성 스타일
        if (persona && persona.age) {
            if (persona.age < 30) instructions += ' 젊은 목소리.';
            else if (persona.age < 50) instructions += ' 중년 목소리.';
            else instructions += ' 노년 목소리.';
        }
        try {
            const key = apiKeyInput.value.trim();
            if (!key) return;
            const res = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini-tts',
                    input: text,
                    voice,
                    instructions,
                    response_format: 'wav',
                    speed: 1.0
                })
            });
            if (!res.ok) throw new Error('TTS API 오류: ' + res.status);
            const audioBlob = await res.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            audioElement.src = audioUrl;
            audioElement.onended = () => {
                isSpeaking = false;
                updateMicStatus('듣는 중');
                if (!isListening && !isPending) safeStartRecognition();
                URL.revokeObjectURL(audioUrl);
            };
            audioElement.onerror = () => {
                isSpeaking = false;
                updateMicStatus('듣는 중');
                if (!isListening && !isPending) safeStartRecognition();
                URL.revokeObjectURL(audioUrl);
            };
            audioElement.play();
        } catch (e) {
            isSpeaking = false;
            updateMicStatus('듣는 중');
            if (!isListening && !isPending) safeStartRecognition();
        }
    }
});

