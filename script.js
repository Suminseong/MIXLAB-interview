
document.addEventListener("DOMContentLoaded", () => {
    // =========================================================
    // ================ 공통 상태 & 엘리먼트 ================
    // =========================================================
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
    const closeApiKeyModalBtn = document.getElementById("closeApiKeyModal");

    const personaBox = document.getElementById("persona-side");
    const personaContainer = document.getElementById("persona-container")
    const personaDecreaseBtn = document.getElementById("persona-decrease-btn");
    const personaIncreaseBtn = document.getElementById("persona-increase-btn");
    const personaCountSpan = document.getElementById("persona-count");
    const callPersonaGPT = document.getElementById("persona-generate-btn");

    const personaLeftBtn = document.getElementById("personaLeftBtn");
    const personaRightBtn = document.getElementById("personaRightBtn");

    const micButton = document.getElementById('micButton');
    const micStatus = document.getElementById('micStatus');
    const sendButton = document.getElementById('sendButton');
    const userInput = document.getElementById('userInput');
    const chatbox = document.getElementById('chatbox');

    const globalAddBtn = document.getElementById("global-question-add-btn");

    let questionNum = 8;
    let personaNum = 3;
    let apiKey = localStorage.getItem("openai_api_key") || "";
    let questions;
    let personaResults = [];
    let selectedPersona = null;            // 인터뷰 진행용
    let selectedPersonaGlobal = null;      // 인터뷰 진입 전 선택 임시 저장
    let interviewDuration = null;          // 분 단위
    let lastIndex = 0;

    // 음성/오디오
    const audioElement = new Audio();
    let isListening = false;
    let isSpeaking = false;
    let isPending = false;

    // 대화/로깅
    let messages = [
        {
            role: "system",
            content:
                `위 정보를 바탕으로, 사용자가 제출한 자료에 맞는 가상의 인물로 연기해주세요. ` +
                `대화는 반드시 대화체로, 불필요한 표, 단락, 기호, 이모지 없이 진행해 주세요.`
        }
    ];
    let interviewLog = [];
    let sendStartTime = null;

    // 실시간 분석 캐시
    let _qEmbeddings = null; // 질문별 임베딩 캐시

    // 웹소켓
    let socket;

    // 타이머
    let interviewTimer = null;
    let remainingSeconds = 0;

    // 파인튜닝·API
    const apiUrl = "https://api.openai.com/v1/chat/completions";
    const modelId = "ft:gpt-4o-2024-08-06:chamkkae:chamkkae-v3a:AmwkrRHc";

    // =========================================================
    // ==================== 유틸/토큰/분석 ====================
    // =========================================================
    async function embedText(key, text) {
        const res = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
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
    async function ensureQuestionEmbeddings(key, qs) {
        if (!Array.isArray(qs) || qs.length === 0) { _qEmbeddings = null; return; }
        _qEmbeddings = await Promise.all(qs.map(q => embedText(key, q)));
    }
    function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
    function msToMinSec(ms) { const s = Math.max(0, Math.floor(ms / 1000)); const m = Math.floor(s / 60); return `${m}m ${String(s % 60).padStart(2, '0')}s`; }
    const KO_STOPWORDS = new Set(['그리고','그러나','하지만','그러면','그래서','또','또는','즉','혹은','이것','저것','그것','거기','여기','저기','좀','아주','매우','너무','정말','진짜','거의','약간','등','등등','같은','것','수','때','점','및','는','은','이','가','을','를','에','의','로','으로','와','과','도','만','에게','한','하다','했습니다','했어요','하는','되다','됐다','됐다가',]);
    function simpleTokenizeKorean(text) {
        return (text || "")
            .replace(/[^\p{Script=Hangul}\w\s]/gu, " ")
            .toLowerCase()
            .split(/\s+/)
            .filter(t => t && t.length > 1 && !KO_STOPWORDS.has(t));
    }
    function extractTopKeywords(logs, topN = 12) {
        if (!Array.isArray(logs) || !logs.length) return [];
        const txt = logs.map(r => `${r.userMessage || ''} ${r.botAnswer || ''}`).join(' ');
        const tokens = simpleTokenizeKorean(txt);
        const map = new Map();
        for (const t of tokens) map.set(t, (map.get(t) || 0) + 1);
        return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([text, count]) => ({ text, weight: count }));
    }
    const ACK_REGEX = /^(네|넵|예|응|어|음|아|맞[아요]|그렇[죠|습니다]?|좋[아요]|오케이|ok)\s*$/i;
    async function classifyQuestionIndex(userText, lastIdx, qs, key) {
        if (!userText || userText.trim().length < 2 || ACK_REGEX.test(userText.trim()))
            return { index: Math.max(0, lastIdx), score: 0, reason: "ack/short" };

        if (!_qEmbeddings) await ensureQuestionEmbeddings(key, qs);
        if (!_qEmbeddings) return { index: Math.max(0, lastIdx), score: 0, reason: "no-emb" };

        const uEmb = await embedText(key, userText);
        const sims = _qEmbeddings.map((e, i) => ({ i, s: cosineSim(uEmb, e) })).sort((a, b) => b.s - a.s);
        const best = sims[0]; const second = sims[1] || { s: 0 };
        const margin = best.s - second.s;

        let idx = best.i + 1; // 질문 배열 0-based → 1부터
        const bigJump = Math.abs(idx - Math.max(1, lastIdx)) >= 3;
        if (bigJump && margin < 0.06) idx = (best.i + 1 > lastIdx) ? lastIdx + 1 : Math.max(1, lastIdx);
        if (best.s < 0.24) idx = Math.max(1, lastIdx);
        if (/(다음|이제|넘어가|본론|그럼)/.test(userText) && lastIdx >= 0)
            idx = Math.min((qs?.length || idx), Math.max(1, lastIdx + 1));

        return { index: idx, score: best.s, reason: `best=${best.s.toFixed(3)} margin=${margin.toFixed(3)}` };
    }

    // =========================================================
    // ===================== 차트/클라우드 =====================
    // =========================================================
    function buildBarChart(ctx, labels, dataSec, highlightIndex = null) {
        if (window.barChartInstance) window.barChartInstance.destroy();
        const bg = dataSec.map((_, i) => (i === highlightIndex ? '#5872FF' : '#DDE2EB'));
        window.barChartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [{ label: '응답 시간(초)', data: dataSec, backgroundColor: bg, borderRadius: 12, barPercentage: 0.6 }] },
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
                datasets: [{ data: [Math.round(pct * 100), Math.round((1 - pct) * 100)], backgroundColor: ['#5872FF', '#F2F3F5'], borderWidth: 0 }]
            },
            options: { cutout: '75%', plugins: { legend: { display: false } }, responsive: false }
        });
    }
    function buildKeywordCloud(el, logs, maxWords = 20) {
        if (!el) return;
        el.innerHTML = '';
        const text = logs.map(r => `${r.userMessage || ''} ${r.botAnswer || ''}`).join(' ');
        const tokens = simpleTokenizeKorean(text);
        const countMap = new Map();
        for (const t of tokens) countMap.set(t, (countMap.get(t) || 0) + 1);
        const words = Array.from(countMap, ([text, count]) => ({ text, count }))
            .sort((a, b) => b.count - a.count).slice(0, maxWords)
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
            }).start();
    }

    // =========================================================
    // ================= 퍼소나/스타일 힌트 ==================
    // =========================================================
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
        personaState = {
            ...personaState,
            name: selected.name || null,
            age: selected.age || null,
            gender: selected.gender || null,
            occupation: selected.occupation || null,
            personality: selected.personality || null,
            speech: selected.speech || null,
            mood: "중립",
            lastTopic: null,
            lastCounterAskedAtIdx: 0,
            followupsOnCurrent: 0
        };
    }
    const GREET_REGEX = /(안녕|안녕하세요|처음|반갑|만나서)/i;
    const SMALLTALK_REGEX = /(날씨|주말|요즘|점심|커피|출근|취미|취향|근황)/i;
    function detectPhase({ lastIndex, turnCount, userText }) {
        if (turnCount <= 2 || GREET_REGEX.test(userText)) return 0;
        if (lastIndex === 0 || SMALLTALK_REGEX.test(userText)) return 1;
        return 2;
    }
    function safeParseJSON(s) {
        try { return JSON.parse(s); } catch (e) {}
        const m = s && s.match(/\{[\s\S]*\}/);
        if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
        return null;
    }
    async function getStyleHintsLLM(key, { personaState, userMessage, phase, predictedIndex, questions }) {
        const base = { tone: "neutral", allow_micro_openers: [], use_short_episode: false, sentence_target: "2-3", followup: { should_ask: false, template: "" } };
        const prompt = `당신은 인터뷰 톤 코치... (생략 없는 기존 프롬프트)`;
        try {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
                body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.6, max_tokens: 300 })
            });
            const data = await res.json();
            const parsed = safeParseJSON(data?.choices?.[0]?.message?.content || "");
            if (!parsed) return base;
            return {
                tone: parsed.tone || base.tone,
                allow_micro_openers: Array.isArray(parsed.allow_micro_openers) ? parsed.allow_micro_openers.slice(0, 3) : [],
                use_short_episode: !!parsed.use_short_episode,
                sentence_target: parsed.sentence_target || base.sentence_target,
                followup: { should_ask: !!(parsed.followup && parsed.followup.should_ask), template: (parsed.followup && parsed.followup.template) || "" }
            };
        } catch { return base; }
    }
    function buildSystemPrompt(interviewTitle, qs, predictedIndex, phase, personaState, styleHints) {
        const qref = Array.isArray(qs) ? qs.join(', ') : '';
        const openers = (styleHints?.allow_micro_openers || []).join(" / ");
        return `
당신은 인터뷰 대상 퍼소나입니다. 자연스러운 구어체로 답변하세요.

[역할] ${personaState.name} (${personaState.age}세, ${personaState.gender}, ${personaState.occupation})
[성격] ${personaState.personality || "평범"}
[언어습관] ${personaState.speech || "자연스러운 구어체"}
[대화 단계] ${phase} (0=아이스브레이킹, 1=잡담, 2=본론)
[현재 질문 번호 후보] ${predictedIndex}
[인터뷰 주제] ${interviewTitle}
[질문 목록(참고)] ${qref}

[스타일 힌트]
- tone: ${styleHints.tone}
- sentence_target: ${styleHints.sentence_target}문장
- optional micro-openers (예시): ${openers || "(없음)"}
- short episode 허용: ${styleHints.use_short_episode ? "가능" : "지양"}
- follow-up 권고: ${styleHints.followup?.should_ask ? `가능 (예: "${styleHints.followup.template.slice(0, 50)}...")` : "지양"}

[원칙]
- 예시 표현을 그대로 복사하지 말고 맥락상 자연스러운 의역만 사용.
- phase<=1에서는 가볍고 짧게, phase=2에서만 간단 사례 1개 가능.
- 이모지·표·메타발화 금지.
- 한 응답은 ${styleHints.sentence_target}문장 정도.
- follow-up이 필요할 때만 맨 끝에 한 문장 질문 1개 추가.
        `.trim();
    }
    async function generateCoreAnswer(key, systemPrompt, userMessage, { phase }) {
        const payload = {
            model: modelId,
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
            temperature: (phase <= 1 ? 0.7 : 0.9),
            max_tokens: (phase <= 1 ? 220 : 420),
            top_p: 1, frequency_penalty: 0.15, presence_penalty: 0.1
        };
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "gen error");
        return (data.choices?.[0]?.message?.content || "").trim();
    }

    // =========================================================
    // ===================== UI 동기화/분석 ====================
    // =========================================================
    function syncPersonaUI(personaResults, selected) {
        const info = document.querySelector('.analyze-profile-info');
        const tags = document.querySelector('.analyze-profile-tags');
        if (info && selected) {
            info.innerHTML = `
                <span class="profile-name">${selected.name || '-'}<\/span>
                <span class="profile-age">${selected.age ? `${selected.age}세` : '-'}<\/span>
                <span class="profile-gender">${selected.gender || '-'}<\/span>
                <span class="profile-type">${selected.personality?.split(',')[0] || '-'}<\/span>
            `;
        }
        if (tags && selected) {
            const tagList = []
                .concat(selected.occupation || '')
                .concat(selected.interests || '')
                .concat(selected.hobby || '')
                .filter(Boolean).slice(0, 4);
            tags.innerHTML = tagList.map(t => `<span>${String(t).trim()}<\/span>`).join('');
        }
        const tabsWrap = document.querySelector('.analyze-persona-tabs');
        if (tabsWrap && Array.isArray(personaResults) && personaResults.length) {
            tabsWrap.innerHTML = personaResults.map((p, i) =>
                `<button class="persona-tab ${selected === personaResults[i] ? 'active' : ''}" data-idx="${i}">${'퍼소나' + (i + 1)}<\/button>`
            ).join('');
            tabsWrap.querySelectorAll('.persona-tab').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = Number(btn.dataset.idx);
                    window.selectPersona(idx);
                    syncPersonaUI(personaResults, personaResults[idx]);
                });
            });
        }
    }
    function deriveInterviewMetrics(log, totalQuestionsHint = null) {
        if (!Array.isArray(log) || log.length === 0) {
            return { perQuestion: [], labels: [], durationsSec: [], totalMs: 0, firstTs: null, lastTs: null, answeredSet: new Set(), totalQuestions: totalQuestionsHint || 0 };
        }
        const perQuestionMap = new Map();
        let firstTs = Infinity, lastTs = -Infinity;
        for (const row of log) {
            const idx = Number(row.questionIndex ?? 0);
            const dur = Math.max(0, (row.timestampEnd || 0) - (row.timestampStart || 0));
            if (!perQuestionMap.has(idx)) perQuestionMap.set(idx, { index: idx, durations: [] });
            perQuestionMap.get(idx).durations.push(dur);
            if (row.timestampStart) firstTs = Math.min(firstTs, row.timestampStart);
            if (row.timestampEnd) lastTs = Math.max(lastTs, row.timestampEnd);
        }
        const perQuestion = Array.from(perQuestionMap.values())
            .sort((a, b) => a.index - b.index)
            .map(q => ({ index: q.index, meanMs: q.durations.length ? sum(q.durations) / q.durations.length : 0, count: q.durations.length }));
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
    function renderAnalysisDashboard({ targetMinutes = 20, highlightQuestionIndex = null } = {}) {
        const analyzePage = document.getElementById('analyze-page');
        if (!analyzePage) return;
        syncPersonaUI(personaResults || [], selectedPersona || null);

        const totalQuestionsHint = (Array.isArray(questions) ? questions.length : null);
        const M = deriveInterviewMetrics(interviewLog || [], totalQuestionsHint);

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
        const donutCanvas = document.getElementById('donutChart');
        const donutPercentEl = document.getElementById('donutPercent');
        const donutTimeEl = document.getElementById('donutTime');

        const elapsed = M.totalMs;
        const targetMs = Math.max(1, targetMinutes * 60 * 1000);
        const progress01 = elapsed / targetMs;

        if (donutCanvas) buildDonutChart(donutCanvas.getContext('2d'), progress01);
        if (donutPercentEl) donutPercentEl.textContent = `${Math.min(100, Math.round(progress01 * 100))}%`;
        if (donutTimeEl) donutTimeEl.textContent = `${msToMinSec(elapsed)} / ${msToMinSec(targetMs)}`;

        const cloudEl = document.getElementById('keywordCloud');
        if (cloudEl) buildKeywordCloud(cloudEl, interviewLog || []);

        const avgChars = (interviewLog || []).length
            ? sum((interviewLog || []).map(r => (r.botAnswer || '').length)) / (interviewLog || []).length
            : 0;
        const speedPct = Math.max(20, Math.min(120, Math.round(avgChars / 80 * 100)));
        const speedBar = document.getElementById('speedBar');
        const speedLabel = document.querySelector('.speed-label');
        if (speedBar) speedBar.style.width = `${speedPct}%`;
        if (speedLabel) speedLabel.textContent = `${speedPct}% ${speedPct > 90 ? '조금 빨랐어요' : (speedPct < 50 ? '다소 느렸어요' : '적당했어요')}`;

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
        const steps = document.querySelectorAll('.affinity-step');
        if (steps && steps.length) {
            const stage = progress01 < 0.33 ? 0 : (progress01 < 0.66 ? 1 : 2);
            steps.forEach((el, i) => el.classList.toggle('active', i === stage));
        }
    }

    // =========================================================
    // ======================= 로딩 스피너 =====================
    // =========================================================
    function showSpinner() { const s = document.getElementById("loadingSpinner"); if (s) s.style.display = "block"; }
    function hideSpinner() { const s = document.getElementById("loadingSpinner"); if (s) s.style.display = "none"; }

    // =========================================================
    // ===================== API 키 모달 =======================
    // =========================================================
    if (!apiKey && apiKeyModal) apiKeyModal.classList.add('active');
    if (saveApiKeyBtn) saveApiKeyBtn.addEventListener("click", () => {
        const enteredKey = apiKeyInput.value.trim();
        if (enteredKey) {
            apiKey = enteredKey;
            localStorage.setItem("openai_api_key", apiKey);
            apiKeyModal?.classList.remove('active');
        } else alert("API 키를 입력해주세요!");
    });
    if (changeApiKeyBtn && apiKeyModal) {
        changeApiKeyBtn.addEventListener('click', () => apiKeyModal.classList.add('active'));
        apiKeyModal.addEventListener('mousedown', (e) => { if (e.target === apiKeyModal) apiKeyModal.classList.remove('active'); });
    }
    if (closeApiKeyModalBtn && apiKeyModal) closeApiKeyModalBtn.addEventListener('click', () => apiKeyModal.classList.remove('active'));

    // =========================================================
    // ===================== 질문 개수 조절 ====================
    // =========================================================
    if (decreaseBtn) decreaseBtn.addEventListener("click", () => {
        if (questionNum > 4) { questionNum--; if (questionNumSpan) questionNumSpan.textContent = questionNum; }
    });
    if (increaseBtn) increaseBtn.addEventListener("click", () => {
        if (questionNum < 16) { questionNum++; if (questionNumSpan) questionNumSpan.textContent = questionNum; }
    });

    // =========================================================
    // ================== 퍼소나 개수 조절 ====================
    // =========================================================
    function addPersonaBox() {
        const wrapper = document.createElement("div");
        wrapper.classList.add("persona-prompt-box");
        const label = document.createElement("label");
        label.setAttribute("for", `promptForPersona${personaNum}`);
        label.textContent = `퍼소나${personaNum}`;
        const input = document.createElement("input");
        input.type = "text";
        input.id = `promptForPersona${personaNum}`;
        input.placeholder = "원하는 설정을 상세히 적어주세요";
        wrapper.appendChild(label); wrapper.appendChild(input);
        personaBox?.appendChild(wrapper);
    }
    function removePersonaBox() {
        const boxes = document.querySelectorAll(".persona-prompt-box");
        if (boxes.length > 0) personaBox?.removeChild(boxes[boxes.length - 1]);
    }
    function getPersonaPrompts() {
        const prompts = [];
        for (let i = 1; i <= personaNum; i++) {
            const inputField = document.getElementById(`promptForPersona${i}`);
            prompts.push(inputField ? inputField.value.trim() : "");
        }
        return prompts;
    }
    if (personaDecreaseBtn) personaDecreaseBtn.addEventListener("click", () => {
        if (personaNum > 1) { personaNum--; personaCountSpan && (personaCountSpan.textContent = personaNum); removePersonaBox(); }
    });
    if (personaIncreaseBtn) personaIncreaseBtn.addEventListener("click", () => {
        if (personaNum < 5) { personaNum++; personaCountSpan && (personaCountSpan.textContent = personaNum); addPersonaBox(); }
    });

    // =========================================================
    // ================= 질문 생성 (GPT) ======================
    // =========================================================
    if (callQuestionGPT) callQuestionGPT.addEventListener("click", async () => {
        showSpinner();
        const interviewTitle = interviewTitleInput?.value?.trim();
        const interviewPurpose = interviewFor?.value?.trim();

        if (!apiKey || !interviewTitle || !interviewPurpose) {
            alert("필수 항목을 입력해주세요!");
            hideSpinner();
            return;
        }

        const payload = {
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: [{ text: `${interviewTitle}를 주제로 한 인터뷰는 ${interviewFor}을 목적으로 해야합니다. 이 인터뷰에서 해야하는는 질문을 ${questionNum}개 생성합니다. 인터뷰 질문은 인터뷰 순서에 맞게 구성되어야 하며, 개수는 user의 프롬프트에 기반합니다. 첫 질문은 인터뷰 주제에 대한 간단한 질문으로 시작합니다. 2번째 질문부터 본격적으로 목적에 맞게 질문을 작성... (원 프롬프트 그대로)`, type: "text" }] }],
            temperature: 0.75, max_tokens: 2048, top_p: 1, frequency_penalty: 0, presence_penalty: 0
        };

        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
                questions = JSON.parse(data.choices[0].message.content);

                // 에디터형 렌더 (UX 개선안)
                renderQuestionsEditor();

                const questionListEl = document.getElementById("questionList");
                if (questionListEl) questionListEl.innerHTML = questions.map((q, i) => `<li>${i + 1}. ${q}</li>`).join("");

                await ensureQuestionEmbeddings(apiKey, questions);

                const nextBtn = document.getElementById("goToPersonaBtn");
                if (nextBtn) { nextBtn.style.display = "block"; nextBtn.style.opacity = "1"; }
            } else {
                resultContainer.innerHTML = "<p>질문 생성 실패</p>";
            }
        } catch (error) {
            console.error(error);
            resultContainer.innerHTML = "<p>에러 발생</p>";
        } finally { hideSpinner(); }
    });

    function renderQuestionsEditor() {
        if (!resultContainer) return;
        resultContainer.innerHTML = questions.map((q, i) => `
            <div class="question-edit-wrapper">
                <span class="question-index-num">${i + 1}.</span>
                <input type="text" class="question-edit-input" value="${q.replace(/"/g, '&quot;')}" data-index="${i}" placeholder="${q === '' ? '내용을 입력하세요.' : ''}" />
                <button class="question-delete-btn" type="button" data-index="${i}" title="삭제">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                        <circle cx="16" cy="16" r="15" fill="#F8F9FB" stroke="#E7F0FF" stroke-width="2"/>
                        <rect x="10" y="15.25" width="12" height="1.5" rx="0.75" fill="#8F949B"/>
                    </svg>
                </button>
            </div>
        `).join("");

        // 입력 폭 자동 보정 + 삭제 버튼 이벤트
        setTimeout(() => {
            const inputs = document.querySelectorAll('.question-edit-input');
            inputs.forEach((input) => {
                const adjustWidth = () => {
                    const tempDiv = document.createElement('div');
                    tempDiv.style.position = 'absolute';
                    tempDiv.style.visibility = 'hidden';
                    tempDiv.style.whiteSpace = 'nowrap';
                    tempDiv.style.font = window.getComputedStyle(input).font;
                    tempDiv.textContent = input.value || input.placeholder;
                    document.body.appendChild(tempDiv);
                    const textWidth = tempDiv.offsetWidth; document.body.removeChild(tempDiv);
                    const extraPx = 120;
                    const minWidthPx = Math.max(100, textWidth + extraPx);
                    const clampWidth = `clamp(7vw, ${(minWidthPx / 16)}rem, 35vw)`;
                    input.style.width = clampWidth;
                    const wrapper = input.closest('.question-edit-wrapper');
                    if (wrapper) wrapper.style.width = clampWidth;
                };
                input.addEventListener('input', adjustWidth);
                adjustWidth();
            });
            const deleteBtns = document.querySelectorAll('.question-delete-btn');
            deleteBtns.forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    const idx = parseInt(this.getAttribute('data-index'));
                    questions.splice(idx, 1);
                    questionNum = questions.length;
                    if (questionNumSpan) questionNumSpan.textContent = questionNum;
                    renderQuestionsEditor();
                    const questionListEl = document.getElementById("questionList");
                    if (questionListEl) questionListEl.innerHTML = questions.map((q, i) => `<li>${i + 1}. ${q}</li>`).join("");
                });
            });
        }, 50);
    }

    // 글로벌 “+” 버튼(행 사이 추가)
    if (globalAddBtn) {
        document.addEventListener("mouseover", (e) => {
            const wrapper = e.target.closest(".question-edit-wrapper");
            if (!wrapper) return;
            const wrappers = [...document.querySelectorAll(".question-edit-wrapper")];
            const currentIndex = wrappers.indexOf(wrapper);
            wrappers.forEach(w => w.classList.remove("hover-next"));
            const nextWrapper = wrappers[currentIndex + 1];
            if (nextWrapper) nextWrapper.classList.add("hover-next");
            wrapper.appendChild(globalAddBtn);
            globalAddBtn.style.opacity = 1;
            globalAddBtn.style.pointerEvents = "auto";
        });
        document.addEventListener("mouseout", (e) => {
            if (!e.relatedTarget?.closest(".question-edit-wrapper")) {
                globalAddBtn.style.opacity = 0;
                globalAddBtn.style.pointerEvents = "none";
                document.querySelectorAll(".question-edit-wrapper").forEach(w => w.classList.remove("hover-next"));
            }
        });
        globalAddBtn.addEventListener("click", () => {
            if (!questions) return;
            const wrappers = Array.from(document.querySelectorAll('.question-edit-wrapper'));
            let hoverIdx = wrappers.findIndex(w => w.contains(globalAddBtn));
            if (hoverIdx === -1) hoverIdx = wrappers.length - 1;
            // 입력값 저장
            const inputs = document.querySelectorAll('.question-edit-input');
            inputs.forEach(input => {
                const idx = parseInt(input.dataset.index);
                if (!isNaN(idx) && idx < questions.length) questions[idx] = input.value;
            });
            // 삽입
            questions.splice(hoverIdx + 1, 0, "");
            questionNum = questions.length;
            if (questionNumSpan) questionNumSpan.textContent = questionNum;
            renderQuestionsEditor();
            setTimeout(() => {
                const wrappers2 = document.querySelectorAll('.question-edit-wrapper');
                const newWrapper = wrappers2[hoverIdx + 1];
                if (newWrapper) {
                    const input = newWrapper.querySelector('input.question-edit-input');
                    input?.focus(); input?.select();
                }
            }, 0);
        });
    }

    // =========================================================
    // ================== 퍼소나 생성 (GPT) ===================
    // =========================================================
    if (callPersonaGPT) callPersonaGPT.addEventListener("click", async () => {
        const interviewTitle = interviewTitleInput?.value?.trim();
        const isSimpleMode = document.getElementById("toggle")?.checked;
        const personaPrompts = isSimpleMode ? [] : getPersonaPrompts();

        if (!apiKey) { alert("API 키를 입력해야 합니다!"); return; }
        if (!interviewTitle) { alert("인터뷰 주제를 입력해주세요!"); return; }

        resultContainer && (resultContainer.innerHTML = "<p>퍼소나를 생성 중입니다...</p>");
        showSpinner();
        personaResults = [];

        // 균등 성비
        const genderArr = Array.from({ length: personaNum }, (_, i) => i % 2 === 0 ? "남성" : "여성");

        try {
            for (let i = 0; i < personaNum; i++) {
                const promptText = personaPrompts[i] || "";
                const gender = genderArr[i];
                const payload = {
                    model: "gpt-4o",
                    messages: [{
                        role: "system",
                        content: [{ text:
`인터뷰에서 사용할 ${i + 1}번째 퍼소나를 생성...
(원본 프롬프트 그대로; 성별은 '${gender}'로 강제)`,
                            type: "text"}]
                    }],
                    temperature: 0.9, max_tokens: 1024, top_p: 1
                };
                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (data.choices && data.choices.length > 0) {
                    const persona = JSON.parse(data.choices[0].message.content);
                    personaResults.push(persona);
                }
            }
        } catch (e) {
            console.error("퍼소나 생성 오류:", e);
            resultContainer && (resultContainer.innerHTML = "<p>퍼소나 생성 중 오류가 발생했습니다.</p>");
        } finally { hideSpinner(); }

        // 이미지 부여 & 렌더
        const manImages = ["img/man-1.png", "img/man-2.png", "img/man-3.png"];
        const womanImages = ["img/woman-1.png", "img/woman-2.png"];
        let usedMan = [], usedWoman = [];
        function pickImage(gender) {
            if (gender === "남성") {
                if (usedMan.length === manImages.length) usedMan = [];
                const avail = manImages.filter(x => !usedMan.includes(x));
                const chosen = avail[Math.floor(Math.random() * avail.length)];
                usedMan.push(chosen); return chosen;
            } else {
                if (usedWoman.length === womanImages.length) usedWoman = [];
                const avail = womanImages.filter(x => !usedWoman.includes(x));
                const chosen = avail[Math.floor(Math.random() * avail.length)];
                usedWoman.push(chosen); return chosen;
            }
        }
        if (personaContainer) {
            personaContainer.innerHTML = personaResults.map((p, idx) => {
                const imgSrc = pickImage(p.gender);
                p.image = imgSrc;
                return `
                    <div class="persona-box" id="persona-${idx}" data-persona-index="${idx}">
                        <img src="${imgSrc}" alt="persona-img" class="persona-img">
                        <p><strong>${p.name}</strong></p>
                        <p><strong>성별:</strong> ${p.gender}</p>
                        <p><strong>연령:</strong> ${p.age}</p>
                        <p><strong>직업:</strong> ${p.occupation}</p>
                        <p><strong>성격:</strong> ${p.personality}</p>
                        <p><strong>관심사:</strong> ${p.interests}</p>
                        <p><strong>언어습관:</strong> ${p.speech}</p>
                    </div>
                `;
            }).join("");
            document.querySelectorAll('.persona-box').forEach(box => {
                box.addEventListener('click', function() {
                    if (this.classList.contains('selected')) this.classList.remove('selected');
                    else {
                        document.querySelectorAll('.persona-box').forEach(b => b.classList.remove('selected'));
                        this.classList.add('selected');
                    }
                });
            });
            document.querySelector('.persona-navigation-con')?.classList.add('show');
            const interviewBtn = document.getElementById("goToInterviewBtn");
            if (interviewBtn) { interviewBtn.style.display = "flex"; interviewBtn.style.opacity = "1"; }
            const personaBtn = document.getElementById("goToPersonaBtn");
            if (personaBtn) { personaBtn.style.display = "none"; personaBtn.style.opacity = "0"; }
        }
    });

    // =========================================================
    // =============== 퍼소나 선택 → 인터뷰 진입 ===============
    // =========================================================
    function renderChatboxPersona(persona) {
        const box = document.querySelector('.chatbox-persona');
        if (!box || !persona) return;
        box.innerHTML = '';
        const g1 = document.createElement('div'); g1.className = 'persona-group';
        const img = document.createElement('img'); img.className = 'persona-img chatbox-persona-img';
        img.src = persona.image || (persona.gender === '여성' ? 'img/woman-1.png' : 'img/man-1.png'); img.alt = persona.name || '';
        g1.appendChild(img);
        const name = document.createElement('span'); name.className = 'persona-name'; name.textContent = persona.name || ''; g1.appendChild(name);

        const g2 = document.createElement('div'); g2.className = 'persona-group';
        [persona.age, persona.gender].forEach(v => { if (v) { const s = document.createElement('span'); s.textContent = v; g2.appendChild(s); } });

        const g3 = document.createElement('div'); g3.className = 'persona-group';
        const occupation = persona.occupation;
        const personality = persona.personality;
        const interests = persona.interests ? persona.interests.split(',')[0].trim() : '';
        const speech = persona.speech ? persona.speech.split(',')[0].trim() : '';
        [occupation, personality, interests, speech].forEach(v => { if (v) { const s = document.createElement('span'); s.textContent = v; g3.appendChild(s); } });

        box.appendChild(g1); box.appendChild(g2); box.appendChild(g3);
    }
    function forceSidebarSwitch() {
        document.querySelectorAll('.container-children').forEach(c => {
            c.classList.remove('sub-activate'); c.classList.add('sub-inactive'); c.style.display = "none";
        });
        const interviewSidebar = document.querySelector('.container-children.sub-interview');
        if (interviewSidebar) {
            interviewSidebar.style.display = "flex";
            interviewSidebar.classList.remove('sub-inactive');
            interviewSidebar.classList.add('sub-activate');
        }
    }
    function waitForElementsThenTimer() {
        const setTimeElement = document.getElementById('set-time');
        const leftTimeElement = document.getElementById('left-time');
        if (setTimeElement && leftTimeElement) setupInterviewTimer();
        else {
            forceSidebarSwitch();
            setTimeout(waitForElementsThenTimer, 300);
        }
    }
    function showInterviewTimeModal() {
        const modal = document.getElementById('interviewTimeModal');
        if (!modal) return;
        modal.style.display = 'flex';
        // 최초 1회만 리스너
        if (!showInterviewTimeModal._init) {
            document.querySelectorAll('.time-option').forEach(opt => {
                opt.addEventListener('click', function() {
                    document.querySelectorAll('.time-option').forEach(o => o.classList.remove('selected'));
                    this.classList.add('selected');
                    interviewDuration = parseInt(this.getAttribute('data-time'));
                });
            });
            document.getElementById('timeModalConfirm')?.addEventListener('click', function() {
                if (!interviewDuration || interviewDuration <= 0) { alert('인터뷰 시간을 선택해주세요.'); return; }
                hideInterviewTimeModal(); startInterview();
            });
            document.getElementById('timeModalCancel')?.addEventListener('click', hideInterviewTimeModal);
            modal.addEventListener('click', (e) => { if (e.target === modal) hideInterviewTimeModal(); });
            showInterviewTimeModal._init = true;
        }
        document.querySelectorAll('.time-option').forEach(opt => opt.classList.remove('selected'));
    }
    function hideInterviewTimeModal() {
        const modal = document.getElementById('interviewTimeModal');
        if (modal) modal.style.display = 'none';
        document.querySelectorAll('.time-option').forEach(opt => opt.classList.remove('selected'));
    }
    function setupInterviewTimer() {
        if (!interviewDuration || interviewDuration <= 0) { alert('인터뷰 시간이 제대로 설정되지 않았습니다.'); return; }
        remainingSeconds = interviewDuration * 60;
        const setTimeElement = document.getElementById('set-time');
        const leftTimeElement = document.getElementById('left-time');
        if (setTimeElement) setTimeElement.textContent = formatTime(remainingSeconds);
        if (leftTimeElement) leftTimeElement.textContent = formatTime(remainingSeconds);
        startTimer();
    }
    function startTimer() {
        if (interviewTimer) clearInterval(interviewTimer);
        if (remainingSeconds <= 0) return;
        interviewTimer = setInterval(() => {
            remainingSeconds--;
            const leftTimeElement = document.getElementById('left-time');
            if (leftTimeElement) leftTimeElement.textContent = formatTime(remainingSeconds);
            if (remainingSeconds <= 0) { clearInterval(interviewTimer); endInterview(); }
        }, 1000);
    }
    function formatTime(seconds) {
        const m = Math.floor(seconds / 60), s = seconds % 60;
        return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    function endInterview() { if (interviewTimer) { clearInterval(interviewTimer); interviewTimer = null; } showInterviewEndModal(); }
    function showInterviewEndModal() {
        const modal = document.createElement('div');
        modal.id = 'interviewEndModal';
        modal.style.cssText = `display:flex;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(255,255,255,.95);z-index:10001;justify-content:center;align-items:center;`;
        const content = document.createElement('div');
        content.style.cssText = `background:white;padding:3rem;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.15);text-align:center;max-width:400px;width:90%;`;
        content.innerHTML = `
            <h3 style="margin-bottom:1.5rem;color:#333;font-size:1.5rem;">인터뷰가 종료되었습니다.</h3>
            <button id="goToAnalysisBtn" style="padding:1rem 2rem;background:#007bff;color:white;border:none;border-radius:8px;font-size:1rem;cursor:pointer;">인터뷰 분석 결과 보러가기</button>
        `;
        modal.appendChild(content);
        document.body.appendChild(modal);
        document.getElementById('goToAnalysisBtn')?.addEventListener('click', () => {
            document.body.removeChild(modal);
            document.querySelector('.btn-analysis')?.click();
        });
    }

    // “인터뷰로 이동” 버튼
    document.getElementById('goToInterviewBtn')?.addEventListener('click', function() {
        const selectedBox = document.querySelector('.persona-box.selected');
        if (!selectedBox) { alert('퍼소나를 선택해주세요.'); return; }
        const index = selectedBox.getAttribute('data-persona-index');
        selectedPersonaGlobal = personaResults[index];
        showInterviewTimeModal();
    });

    function startInterview() {
        selectedPersona = selectedPersonaGlobal;
        if (!selectedPersona) { alert('퍼소나를 선택해주세요.'); return; }
        initPersonaStateFrom(selectedPersona);

        // 상단 탭/페이지 전환(스크롤 흔들림 최소화)
        const navItems = Array.from(document.querySelectorAll("#nav-bar > div"));
        navItems.forEach(nav => nav.classList.remove("nav-active"));
        const interviewTab = document.querySelector('.btn-interview');
        interviewTab?.classList.add("nav-active");
        document.querySelectorAll(".nav-img svg").forEach(svg => svg.querySelector("path")?.setAttribute("fill", "#CDD1D6"));
        interviewTab?.querySelector(".nav-img svg")?.querySelector("path")?.setAttribute("fill", "#5B5E63");
        const pages = document.querySelectorAll("#result .page");
        pages.forEach((page, idx) => { page.style.display = (idx === 2 ? "block" : "none"); page.style.opacity = (idx === 2 ? 1 : 0); });

        forceSidebarSwitch();
        setTimeout(waitForElementsThenTimer, 100);

        renderChatboxPersona(selectedPersona);
    }

    // =========================================================
    // ===================== 웹소켓 & 오디오 ===================
    // =========================================================
    function connectWebSocket() {
        try {
            socket = new WebSocket("ws://localhost:5501/ws");
            socket.onopen = () => console.log("WebSocket connected.");
            socket.onmessage = async (event) => {
                try {
                    const audioBlob = new Blob([event.data], { type: 'audio/wav' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    audioElement.src = audioUrl;
                    audioElement.play();
                    console.log(`이전에 입력된 시스템 프롬프트는? [${messages[0].content}]`);
                } catch (err) { console.error("WS message error:", err); }
            };
            socket.onclose = (e) => console.warn("WebSocket closed:", e.code);
            socket.onerror = (e) => console.error("WebSocket error:", e);
        } catch (e) { console.warn("WebSocket init error", e); }
    }
    connectWebSocket();

    // =========================================================
    // ==================== 마이크/음성 인식 ===================
    // =========================================================
    function updateMicStatus(status) {
        if (micStatus) micStatus.textContent = status;
        if (micButton) {
            if (status === '듣는 중') micButton.classList.add('active');
            else micButton.classList.remove('active');
        }
    }
    const speechRecognition = (window.SpeechRecognition || window.webkitSpeechRecognition) ? new (window.SpeechRecognition || window.webkitSpeechRecognition)() : null;
    if (speechRecognition) {
        speechRecognition.lang = 'ko-KR';
        speechRecognition.interimResults = false;
        speechRecognition.continuous = false;
        function safeStartRecognition() { try { speechRecognition.start(); } catch (e) {} }
        speechRecognition.onstart = () => { isListening = true; updateMicStatus('듣는 중'); };
        speechRecognition.onend = () => { isListening = false; updateMicStatus('대기'); if (!isSpeaking && !isPending) setTimeout(safeStartRecognition, 250); };
        speechRecognition.onerror = (event) => {
            isListening = false; updateMicStatus('에러');
            const nonFatal = ['no-speech','audio-capture','not-allowed','aborted'];
            if (!isSpeaking && !isPending && !nonFatal.includes(event.error)) setTimeout(safeStartRecognition, 600);
        };
        speechRecognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const res = event.results[i];
                if (res.isFinal) finalTranscript += res[0].transcript;
            }
            if (finalTranscript) {
                userInput && (userInput.value = finalTranscript);
                sendMessage(finalTranscript, true);
            }
        };
        setTimeout(() => safeStartRecognition(), 500);
        micButton?.addEventListener("click", () => { if (!isListening) safeStartRecognition(); });
    } else {
        micButton?.addEventListener("click", () => alert('이 브라우저는 음성 인식을 지원하지 않습니다.'));
    }

    // =========================================================
    // ====================== 채팅 렌더링 ======================
    // =========================================================
    let lastHighlightedIndex = null;
    function highlightCurrentQuestion(index) {
        const items = document.querySelectorAll('#questionList li');
        if (!items || !items.length) return;
        if (index === 0) {
            items.forEach(it => it.classList.remove('active-question'));
            lastHighlightedIndex = null; return;
        }
        const real = index - 1;
        if (lastHighlightedIndex === real) return;
        items.forEach((it, i) => it.classList.toggle('active-question', i === real));
        lastHighlightedIndex = real;
    }
    function appendMessage(message, sender) {
        if (!chatbox) return;
        if (sender === 'bot') {
            const wrapper = document.createElement('div'); wrapper.className = 'message-wrapper';
            const nameTag = document.createElement('div'); nameTag.className = 'persona-name-tag';
            nameTag.textContent = (selectedPersona?.name ? selectedPersona.name.slice(-2) : "퍼소나");
            const el = document.createElement('div'); el.className = 'message bot'; el.textContent = message;
            wrapper.appendChild(nameTag); wrapper.appendChild(el); chatbox.appendChild(wrapper);
        } else {
            const el = document.createElement('div'); el.className = `message ${sender}`; el.textContent = message; chatbox.appendChild(el);
        }
        chatbox.scrollTop = chatbox.scrollHeight;
    }
    function appendStageMessage(text) {
        if (!chatbox) return;
        const divider = document.createElement('div');
        divider.className = "stage-message";
        divider.textContent = `--- ${text} ---`;
        Object.assign(divider.style, { textAlign: "center", color: "#999", fontSize: "14px", margin: "16px 0" });
        chatbox.appendChild(divider);
    }

    // =========================================================
    // ==================== 전송 & 응답 생성 ===================
    // =========================================================
    function approxTokenCount(text) { if (!text) return 0; return Math.ceil(text.length / 3); }
    const FILLER_REGEX = /(\b|\s)(음+|어+|그+|그러니까|그런데|뭐랄까)(?=\b|\s)/g;
    function countFillers(text) { if (!text) return 0; const m = text.match(FILLER_REGEX); return m ? m.length : 0; }
    function extractTopicHint(text) { return (text || '').slice(0, 24); }

    async function speakTextPersona(text, persona) {
        if (!text) return;
        isSpeaking = true;
        let voice = 'coral';
        if (persona?.gender) {
            const g = String(persona.gender).trim();
            if (['여자','여성','female','woman'].includes(g)) voice = 'alloy';
            else if (['남자','남성','male','man'].includes(g)) voice = 'echo';
        }
        let instructions = '자연스럽고 친근한 톤으로 말해주세요.';
        if (persona?.speech) instructions += ` ${persona.speech}`;
        if (persona?.age) {
            if (persona.age < 30) instructions += ' 젊은 목소리.';
            else if (persona.age < 50) instructions += ' 중년 목소리.';
            else instructions += ' 노년 목소리.';
        }
        try {
            const key = apiKeyInput?.value?.trim() || apiKey;
            if (!key) return;
            const res = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                body: JSON.stringify({ model: 'gpt-4o-mini-tts', input: text, voice, instructions, response_format: 'wav', speed: 1.0 })
            });
            if (!res.ok) throw new Error('TTS API 오류: ' + res.status);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            audioElement.src = url;
            audioElement.onended = () => { isSpeaking = false; updateMicStatus('듣는 중'); URL.revokeObjectURL(url); if (!isListening && !isPending && speechRecognition) speechRecognition.start?.(); };
            audioElement.onerror = () => { isSpeaking = false; updateMicStatus('듣는 중'); URL.revokeObjectURL(url); if (!isListening && !isPending && speechRecognition) speechRecognition.start?.(); };
            audioElement.play();
        } catch {
            isSpeaking = false; updateMicStatus('듣는 중');
            if (!isListening && !isPending && speechRecognition) speechRecognition.start?.();
        }
    }

    async function sendMessage(voiceInput, isVoice) {
        const key = apiKeyInput?.value?.trim() || apiKey;
        let userMessage = (typeof voiceInput === 'string') ? voiceInput : (userInput?.value?.trim() || '');
        if (!key) { alert('API 키를 입력해주세요.'); return; }
        if (!userMessage) { alert('메시지를 입력해주세요.'); return; }
        if (!selectedPersona) { alert("먼저 퍼소나를 선택해주세요."); return; }

        // 질문 인덱스 예측
        let predicted = { index: Math.max(1, lastIndex || 1), score: 0, reason: "default" };
        try { predicted = await classifyQuestionIndex(userMessage, lastIndex || 0, questions || [], key); } catch {}

        highlightCurrentQuestion(predicted.index);
        if (predicted.index === 1 && lastIndex === 0 && !chatbox?.querySelector('.stage-message')) {
            appendStageMessage("인터뷰를 시작합니다");
        }
        lastIndex = predicted.index;

        appendMessage(userMessage, 'user');
        if (!isVoice && userInput) userInput.value = '';

        const interviewTitle = interviewTitleInput?.value?.trim() || '';
        const turnCount = (interviewLog || []).length + 1;
        const phase = detectPhase({ lastIndex, turnCount, userText: userMessage });

        sendStartTime = Date.now(); isPending = true; updateMicStatus('GPT 응답 대기');
        try {
            const styleHints = await getStyleHintsLLM(key, { personaState, userMessage, phase, predictedIndex: predicted.index, questions });
            const systemPrompt = buildSystemPrompt(interviewTitle, questions, predicted.index, phase, personaState, styleHints);
            const coreAnswer = await generateCoreAnswer(key, systemPrompt, userMessage, { phase });
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
                userMessage, botAnswer: finalAnswer,
                timestampStart: sendStartTime, timestampEnd: endTime,
                userChars, botChars,
                userTokens: approxTokenCount(userMessage),
                botTokens: approxTokenCount(finalAnswer),
                userFillerCount, userEmotion: null, botAcknowledged: null
            });

            if (interviewLog.length >= 2 && interviewLog[interviewLog.length - 2].questionIndex === lastIndex) personaState.followupsOnCurrent += 1;
            else personaState.followupsOnCurrent = 0;
            personaState.lastTopic = extractTopicHint(userMessage) || personaState.lastTopic;

            await speakTextPersona(finalAnswer, selectedPersona);
            if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ apiKey: key, gptResponse: finalAnswer }));

            isPending = false; updateMicStatus('듣는 중');
        } catch (error) {
            appendMessage(`Error: ${error.message}`, 'bot');
            isPending = false; updateMicStatus('대기');
        }
    }

    sendButton?.addEventListener("click", () => sendMessage());
    userInput?.addEventListener("keypress", (e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } });

    // 인터뷰 종료 → 분석 페이지
    document.getElementById("endInterviewBtn")?.addEventListener("click", () => { endInterview(); });

    // 분석 탭 진입 시 자동 렌더 (있을 때만)
    if (document.getElementById('analyze-page')) {
        renderAnalysisDashboard({ targetMinutes: 20 });
    }

    // 질문지 → 퍼소나 탭 이동
    document.getElementById("goToPersonaBtn")?.addEventListener("click", () => {
        const inputs = document.querySelectorAll('.question-edit-input');
        let hasEmpty = false;
        inputs.forEach(input => { if (!input.value.trim()) hasEmpty = true; });
        if (hasEmpty) { alert('질문지 내용을 입력해주세요.'); return; }
        document.getElementById("question-page")?.style && (document.getElementById("question-page").style.display = "none");
        document.getElementById("persona-page")?.style && (document.getElementById("persona-page").style.display = "block");
        document.querySelector(".btn-persona")?.click();
    });

    // =========================================================
    // ================== 퍼소나 빠른 선택 API =================
    // =========================================================
    window.selectPersona = function (index) {
        if (!personaResults || !personaResults[index]) { alert("퍼소나 데이터가 없습니다."); return; }
        selectedPersona = personaResults[index];
        initPersonaStateFrom(selectedPersona);
        alert(`${selectedPersona.name} 퍼소나를 선택하였습니다.`);

        document.getElementById("persona-page")?.style && (document.getElementById("persona-page").style.display = "none");
        document.getElementById("interview-page")?.style && (document.getElementById("interview-page").style.display = "block");

        if (chatbox) {
            chatbox.innerHTML = `
                <div><strong>인터뷰 대상:</strong> ${selectedPersona.name} (${selectedPersona.occupation})</div>
                <div><strong>성격:</strong> ${selectedPersona.personality}</div>
            `;
        }
    };

    // =========================================================
    // ==================== 퍼소나 슬라이드 UI =================
    // =========================================================
    let personaPageIndex = 0;
    function getPersonaCount() { return personaContainer ? personaContainer.children.length : 0; }
    function updatePersonaSlide() {
        if (!personaContainer) return;
        const personas = personaContainer.children;
        const visibleCount = 2;
        for (let i = 0; i < personas.length; i++) {
            personas[i].style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            personas[i].style.opacity = '0';
            personas[i].style.transform = 'translateX(30px) scale(0.95)';
        }
        setTimeout(() => {
            for (let i = 0; i < personas.length; i++) personas[i].style.display = 'none';
            const startIndex = personaPageIndex;
            const endIndex = Math.min(startIndex + visibleCount, personas.length);
            for (let i = startIndex; i < endIndex; i++) {
                if (personas[i]) {
                    personas[i].style.display = 'block';
                    setTimeout(() => {
                        personas[i].style.opacity = '1';
                        personas[i].style.transform = 'translateX(0px) scale(1)';
                    }, (i - startIndex) * 100 + 50);
                }
            }
        }, 200);
    }
    personaLeftBtn?.addEventListener("click", () => { if (personaPageIndex > 0) { personaPageIndex--; updatePersonaSlide(); } });
    personaRightBtn?.addEventListener("click", () => {
        const total = getPersonaCount();
        const visible = 2;
        const maxIndex = Math.max(0, total - visible);
        if (personaPageIndex < maxIndex) { personaPageIndex++; updatePersonaSlide(); }
    });

    // =========================================================
    // ===================== 인트로 애니메이션 =================
    // =========================================================
    try {
        if (window.gsap && window.MotionPathPlugin) {
            gsap.registerPlugin(MotionPathPlugin);
            const path = document.querySelector("#motion-path");
            const spans = document.querySelectorAll("#intro-logo span");
            const logo = document.getElementById("intro-logo");
            const svgWrapper = document.querySelector(".svg-wrapper");

            if (path && spans.length && logo && svgWrapper) {
                const svg = path.closest("svg");
                const tl = gsap.timeline();
                tl.to(spans, { y: 0, opacity: 1, stagger: 0.08, duration: 0.7, ease: "power2.out" });
                tl.add(() => {
                    for (let i = 0; i < 10; i++) {
                        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                        circle.setAttribute("r", "3"); circle.setAttribute("fill", "white"); circle.setAttribute("opacity", "0");
                        svg.appendChild(circle);
                        gsap.to(circle, {
                            motionPath: { path, align: path, alignOrigin: [0.5, 0.5], start: 0, end: 1 },
                            keyframes: [{ scale: .8, opacity: 1, duration: 0 },{ scale: 1.4, opacity: 1, duration: .6 },{ scale: 1.0, opacity: 0, duration: .6 }],
                            duration: 1.2, ease: "power2.out", delay: i * 0.08, transformOrigin: "center center",
                            onComplete: () => circle.remove()
                        });
                    }
                }, "+=0.2");
                tl.to([logo, svgWrapper], { y: -150, duration: 1, ease: "power2.inOut", opacity: 0 }, "+=0.5");
                tl.to("#intro", { opacity: 0, duration: 0.6, ease: "power2.inOut" }, "-=0.5");
                tl.set("#intro", { display: "none" });
            }
        }
    } catch (e) { /* 애니메이션 없는 환경 무시 */ }

});