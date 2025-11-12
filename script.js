// ---------- Emotion cards: simple local renderer (fallback) ----------
function renderEmotionalCardsLocal(selector = '#emotionList', logs = []) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return;

    // Heuristics from logs
    const textAll = Array.isArray(logs) ? logs.map(r => `${r.userMessage || ''} ${r.botAnswer || ''}`).join(' ') : '';
    const hasLaugh = /웃|하하|호호|하핫|헤헤|^\s*\)|\(:/gm.test(textAll);

    const hasDiscomfort = /(불편|싫|짜증|불만|거부|불쾌|꺼려|곤란|기분 나쁘)/gm.test(textAll);

    // pause detection between turns (>= 15s)
    let longPauseCount = 0;
    if (Array.isArray(logs) && logs.length > 1) {
        for (let i = 1; i < logs.length; i++) {
            const prevEnd = logs[i - 1].timestampEnd || logs[i - 1].timestamp || 0;
            const curStart = logs[i].timestampStart || logs[i].timestamp || 0;
            const gap = curStart && prevEnd ? (curStart - prevEnd) / 1000 : 0; // seconds
            if (gap >= 15) longPauseCount++;
        }
    }

    const items = [];
    if (longPauseCount > 0) {
        items.push({
            tone: 'neutral',
            title: '망설임(침묵, 주저) 상황',
            desc: '긴 침묵 구간이 감지되었어요. 침묵 뒤에는 개방형 질문이나 공감형 코멘트로 부드럽게 이어가 보세요.'
        });
    }
    if (hasLaugh) {
        items.push({
            tone: 'positive',
            title: '웃음(긍정적 정서) 상황',
            desc: '웃음/긍정 신호가 발견되었어요. 분위기를 확장할 수 있는 팔로업 질문을 시도해 보세요.'
        });
    }
    if (hasDiscomfort) {
        items.push({
            tone: 'negative',
            title: '부정적 반응(불만, 거부, 불편) 상황',
            desc: '불편/거부감 신호가 감지되었어요. 추가 확인 질문과 공감 표현으로 신뢰를 회복해 보세요.'
        });
    }

    if (items.length === 0) {
        items.push({
            tone: 'neutral',
            title: '정서적 신호 없음',
            desc: '뚜렷한 정서 신호를 찾기 어려웠어요. 더 다양한 유도 질문으로 감정 표현을 이끌어 보세요.'
        });
    }

    el.innerHTML = items.map(({ tone, title, desc }) => `
        <li class="${tone}">
            <div>
                <strong>${title}<span class="tone">${tone === 'positive' ? '긍정' : tone === 'negative' ? '부정' : '중립'}</span></strong>
                <div>${desc}</div>
            </div>
        </li>
    `).join('');
}

// 간단한 키워드 클라우드 빌더(외부 라이브러리 없이 동작)
function buildKeywordCloud(el, logs, maxWords = 20) {
    if (!el) return;
    if (typeof window !== 'undefined' && typeof window.buildKeywordCloud === 'function' && window.buildKeywordCloud !== buildKeywordCloud) {
        try {
            window.buildKeywordCloud(el, logs, maxWords);
            return;
        } catch (err) {
            console.warn('Delegated buildKeywordCloud failed, using local fallback.', err);
        }
    }

    el.innerHTML = '';
    el.style.position = el.style.position || 'relative';
    el.style.overflow = 'hidden';

    const fallbackExtractTopKeywords = (sourceLogs, topN = 20) => {
        if (!Array.isArray(sourceLogs) || !sourceLogs.length) return [];
        const KO_STOPWORDS_LOCAL = new Set(['그리고', '그러나', '하지만', '그러면', '그래서', '또', '또는', '즉', '혹은', '이것', '저것', '그것', '거기', '여기', '저기', '좀', '아주', '매우', '너무', '정말', '진짜', '거의', '약간', '등', '등등', '같은', '것', '수', '때', '점', '및', '는', '은', '이', '가', '을', '를', '에', '의', '로', '으로', '와', '과', '도', '만', '에게', '한', '하다', '했습니다', '했어요', '하는', '되다', '됐다']);
        const text = sourceLogs.map(r => `${r.userMessage || ''} ${r.botAnswer || ''}`).join(' ');
        const tokens = (text || '').replace(/[^\uAC00-\uD7A3\w\s]/g, ' ').toLowerCase().split(/\s+/).filter(t => t && t.length > 1 && !KO_STOPWORDS_LOCAL.has(t));
        const freq = new Map();
        for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
        const entries = [...freq.entries()].sort((a, b) => b[1] - a[1]).filter(([, count]) => count > 1);
        return entries.slice(0, topN).map(([text, count]) => ({ text, weight: count }));
    };

    let keywords = [];
    try {
        if (typeof extractTopKeywords === 'function') {
            keywords = extractTopKeywords(logs, maxWords) || [];
        } else {
            keywords = fallbackExtractTopKeywords(logs, maxWords) || [];
        }
    } catch (err) {
        console.warn('Keyword extraction failed, falling back to simple display.', err);
        keywords = [];
    }

    if (!keywords.length) {
        const span = document.createElement('span');
        span.className = 'keyword-pill color-gray size-md';
        span.textContent = '-';
        el.appendChild(span);
        return;
    }

    const words = keywords.map((k, i) => ({ text: k.text, size: Math.max(12, 12 + (k.weight || 1) * 4), index: i }));
    const W = Math.max(200, el.clientWidth || el.offsetWidth || 300);
    const H = Math.max(80, el.clientHeight || el.offsetHeight || 140);
    const placedRects = [];

    try {
        words.forEach(word => {
            const span = document.createElement('span');
            span.textContent = word.text;
            span.style.position = 'absolute';
            span.style.display = 'inline-block';
            span.style.fontSize = word.size + 'px';
            span.style.lineHeight = '1';
            span.style.whiteSpace = 'nowrap';
            span.style.fontFamily = 'Pretendard, system-ui, Arial';
            span.style.color = word.index === 0 ? '#5872FF' : '#B0B4BC';
            span.style.cursor = 'default';
            span.style.userSelect = 'none';
            span.style.zIndex = String(1000 - word.index);
            el.appendChild(span);

            const spanW = span.offsetWidth || (word.text.length * (word.size * 0.55));
            const spanH = span.offsetHeight || (word.size * 1.05);
            const cx = W / 2 - spanW / 2;
            const cy = H / 2 - spanH / 2;
            let placed = false;
            const maxAttempts = 800;
            for (let a = 0; a < maxAttempts; a++) {
                const t = a * 0.35;
                const radius = 5 + a * 0.6;
                const x = Math.round(cx + radius * Math.cos(t));
                const y = Math.round(cy + radius * Math.sin(t));
                const nx = Math.max(0, Math.min(W - spanW, x));
                const ny = Math.max(0, Math.min(H - spanH, y));
                const rect = { x: nx, y: ny, w: spanW, h: spanH };
                let overlap = false;
                for (const r of placedRects) {
                    if (!(rect.x + rect.w < r.x || rect.x > r.x + r.w || rect.y + rect.h < r.y || rect.y > r.y + r.h)) { overlap = true; break; }
                }
                if (!overlap) {
                    placedRects.push(rect);
                    span.style.left = rect.x + 'px';
                    span.style.top = rect.y + 'px';
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                const rx = Math.max(0, Math.min(W - spanW, Math.floor(Math.random() * Math.max(1, W - spanW))));
                const ry = Math.max(0, Math.min(H - spanH, Math.floor(Math.random() * Math.max(1, H - spanH))));
                placedRects.push({ x: rx, y: ry, w: spanW, h: spanH });
                span.style.left = rx + 'px';
                span.style.top = ry + 'px';
            }
        });
        el.style.minHeight = H + 'px';
    } catch (err) {
        console.warn('Failed to layout keyword cloud, reverting to pill list.', err);
        el.innerHTML = '';
        keywords.forEach(k => {
            const span = document.createElement('span');
            span.className = 'keyword-pill color-gray size-md';
            span.textContent = k.text;
            el.appendChild(span);
        });
    }
}

// ---------- 실사용 renderAnalysisDashboard 대체 함수 ----------
async function renderAnalysisDashboard(opts = {}) {
    const targetMinutes = opts.targetMinutes || (window.interviewDuration || 20);
    const highlightQuestionIndex = opts.highlightQuestionIndex || null;

    const logs = Array.isArray(window.interviewLog) ? window.interviewLog.slice() : [];
    // 안전: 로그가 없으면 가벼운 안내 메시지만 보여주고 AnalyticsKit 렌더라도 호출
    const hasLogs = logs.length > 0;

    // 1) 질문별 평균 응답시간 계산 (질문 개수는 8 고정 또는 questions.length)
    const qCount = (window.questions && window.questions.length) ? window.questions.length : 8;
    const sumSecs = new Array(qCount).fill(0);
    const cnts = new Array(qCount).fill(0);

    logs.forEach(entry => {
        const qi = (entry.questionIndex || 1) - 1;
        if (qi >= 0 && qi < qCount && entry.timestampStart && entry.timestampEnd) {
            const s = Math.max(0, (entry.timestampEnd - entry.timestampStart) / 1000);
            sumSecs[qi] += s;
            cnts[qi] += 1;
        }
    });

    const avgSecs = sumSecs.map((s, i) => cnts[i] ? Math.round((s / cnts[i]) * 10) / 10 : 0);

    // 2) Bar chart (Chart.js)
    try {
        const barCtx = document.getElementById('barChart') && document.getElementById('barChart').getContext('2d');
        if (barCtx) {
            if (window.barChartInstance) window.barChartInstance.destroy();
            const labels = Array.from({ length: qCount }, (_, i) => `Q${i + 1}`);
            const valueOnBarPlugin = {
                id: 'valueOnBar',
                afterDatasetsDraw(chart) {
                    const { ctx, chartArea } = chart;
                    const meta = chart.getDatasetMeta(0);
                    if (!meta) return;
                    ctx.save();
                    meta.data.forEach((bar, idx) => {
                        const raw = chart.data.datasets[0].data[idx];
                        if (raw == null || !Number.isFinite(raw)) return;
                        const formatted = Number.isInteger(raw) ? `${raw}초` : `${raw.toFixed(1)}초`;
                        let y = bar.y - 6;
                        if (y < chartArea.top + 6) y = chartArea.top + 6;
                        ctx.fillStyle = '#4A4F58';
                        ctx.font = '500 12px Pretendard, system-ui';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(formatted, bar.x, y);
                    });
                    ctx.restore();
                }
            };
            window.barChartInstance = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: '응답 시간(초)',
                        data: avgSecs,
                        backgroundColor: avgSecs.map((v, i) => i === (highlightQuestionIndex ? highlightQuestionIndex - 1 : 1) ? '#5872FF' : '#DDE2EB'),
                        borderRadius: 12,
                        barPercentage: 0.6
                    }]
                },
                options: {
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => `${ctx.parsed.y}초`
                            }
                        }
                    },
                    scales: {
                        y: {
                            min: 0,
                            max: Math.max(30, Math.ceil(Math.max(...avgSecs) / 10) * 10),
                            ticks: { stepSize: 10, color: '#B0B4BC', font: { size: 13 } },
                            grid: { color: '#F2F3F5' }
                        },
                        x: {
                            ticks: { color: '#B0B4BC', font: { size: 13 } },
                            grid: { display: false }
                        }
                    }
                },
                plugins: [valueOnBarPlugin]
            });
        }
    } catch (e) {
        console.warn('bar chart render failed', e);
    }

    // 3) Donut: 총 경과 시간 기반 % (elapsedMinutes / targetMinutes)
    try {
        let elapsedMinutes = 0;
        if (hasLogs) {
            const start = logs[0].timestampStart || logs[0].timestamp || Date.now();
            const end = logs[logs.length - 1].timestampEnd || logs[logs.length - 1].timestamp || Date.now();
            elapsedMinutes = Math.max(0, (end - start) / 60000);
        } else {
            elapsedMinutes = 0;
        }
        const percent = Math.min(100, Math.round((elapsedMinutes / Math.max(1, targetMinutes)) * 100));
        // donut chart instance
        const donutCtxEl = document.getElementById('donutChart');
        if (donutCtxEl) {
            const donutCtx = donutCtxEl.getContext('2d');
            if (window.donutChartInstance) window.donutChartInstance.destroy();
            window.donutChartInstance = new Chart(donutCtx, {
                type: 'doughnut',
                data: { labels: ['진행', '남음'], datasets: [{ data: [percent, 100 - percent], backgroundColor: ['#5872FF', '#F2F3F5'], borderWidth: 0 }] },
                options: { cutout: '75%', plugins: { legend: { display: false } }, responsive: false }
            });
        }
        const donutPercentEl = document.getElementById('donutPercent');
        const donutTimeEl = document.getElementById('donutTime');
        if (donutPercentEl) donutPercentEl.textContent = `${percent}%`;
        if (donutTimeEl) donutTimeEl.textContent = `${Math.round(elapsedMinutes)}m / ${targetMinutes}m`;
    } catch (e) {
        console.warn('donut render failed', e);
    }

    // 4) 핵심 키워드 (pill 스타일 클라우드)
    try {
        const kw = (typeof extractTopKeywords === 'function')
            ? extractTopKeywords(logs, 8)
            : (function fallbackExtractTopKeywords(logs, topN = 8) {
                if (!Array.isArray(logs) || !logs.length) return [];
                const KO_STOPWORDS_LOCAL = new Set(['그리고', '그러나', '하지만', '그러면', '그래서', '또', '또는', '즉', '혹은', '이것', '저것', '그것', '거기', '여기', '저기', '좀', '아주', '매우', '너무', '정말', '진짜', '거의', '약간', '등', '등등', '같은', '것', '수', '때', '점', '및', '는', '은', '이', '가', '을', '를', '에', '의', '로', '으로', '와', '과', '도', '만', '에게', '한', '하다', '했습니다', '했어요', '하는', '되다', '됐다']);
                const text = logs.map(r => `${r.userMessage || ''} ${r.botAnswer || ''}`).join(' ');
                const tokens = (text || '').replace(/[^ - - - -\p{Script=Hangul}\w\s]/gu, ' ').toLowerCase().split(/\s+/).filter(t => t && t.length > 1 && !KO_STOPWORDS_LOCAL.has(t));
                const freq = new Map();
                for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
                const entries = [...freq.entries()].sort((a, b) => b[1] - a[1]).filter(([, count]) => count > 1);
                return entries.slice(0, topN).map(([text, count]) => ({ text, weight: count }));
            })(logs, 12);

        const cloudEl = document.getElementById('keywordCloud');
        if (cloudEl) {
            // use the new buildKeywordCloud helper to render a scattered cloud map
            try {
                buildKeywordCloud(cloudEl, logs, 12);
            } catch (err) {
                // fallback to simple pill list if something goes wrong
                cloudEl.innerHTML = '';
                if (kw && kw.length) {
                    kw.forEach(k => {
                        const span = document.createElement('span');
                        span.className = 'keyword-pill color-gray size-md';
                        span.textContent = k.text;
                        cloudEl.appendChild(span);
                    });
                } else {
                    const span = document.createElement('span');
                    span.className = 'keyword-pill color-gray size-md';
                    span.textContent = '-';
                    cloudEl.appendChild(span);
                }
            }
        }
    } catch (e) {
        console.warn('keyword cloud failed', e);
    }

    // 5) 요약/정서적 대응
    try {
        const summaryEl = document.getElementById('summaryText');
        if (summaryEl) {
            summaryEl.textContent = '생성중...';
            if (!hasLogs) {
                summaryEl.textContent = '인터뷰 로그가 없어 요약을 생성할 수 없습니다.';
            } else {
                try {
                    // 간단 추출 요약: 상위 키워드 나열 + 간단 통계
                    const topKWarr = (typeof extractTopKeywords === 'function')
                        ? extractTopKeywords(logs, 5)
                        : (function fallbackExtractTopKeywords(logs, topN = 5) {
                            if (!Array.isArray(logs) || !logs.length) return [];
                            const KO_STOPWORDS_LOCAL = new Set(['그리고', '그러나', '하지만', '그러면', '그래서', '또', '또는', '즉', '혹은', '이것', '저것', '그것', '거기', '여기', '저기', '좀', '아주', '매우', '너무', '정말', '진짜', '거의', '약간', '등', '등등', '같은', '것', '수', '때', '점', '및', '는', '은', '이', '가', '을', '를', '에', '의', '로', '으로', '와', '과', '도', '만', '에게', '한', '하다', '했습니다', '했어요', '하는', '되다', '됐다']);
                            const text = logs.map(r => `${r.userMessage || ''} ${r.botAnswer || ''}`).join(' ');
                            // keep hangul, word chars and whitespace; remove punctuation
                            const tokens = (text || '').replace(/[^\uAC00-\uD7A3\w\s]/g, ' ').toLowerCase().split(/\s+/).filter(t => t && t.length > 1 && !KO_STOPWORDS_LOCAL.has(t));
                            const freq = new Map();
                            for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
                            const entries = [...freq.entries()].sort((a, b) => b[1] - a[1]).filter(([, count]) => count > 1);
                            return entries.slice(0, topN).map(([text, count]) => ({ text, weight: count }));
                        })(logs, 5);
                    const topKW = topKWarr.map(k => k.text).join(', ');
                    summaryEl.textContent = `주요 키워드: ${topKW}. 총 질의응답 수: ${logs.length}. 평균 응답시간: ${Math.round((avgSecs.reduce((a, b) => a + b, 0) / (qCount || 1)) * 10) / 10}초(질문당).`;
                } catch (err) {
                    summaryEl.textContent = '인터뷰 요약에 실패했습니다';
                }
            }
        }

        // 정서적 카드: AnalyticsKit Emotions 사용 권장
        if (window.AnalyticsKit && window.AnalyticsKit.Emotions && typeof window.AnalyticsKit.Emotions.renderEmotionalCards === 'function') {
            // 마크업은 #emotionList (index.html) 있으므로 명시
            await window.AnalyticsKit.Emotions.renderEmotionalCards('#emotionList');
        } else {
            // 폴백: 로컬 휴리스틱 렌더러
            renderEmotionalCardsLocal('#emotionList', logs);
        }
    } catch (e) {
        console.warn('summary/emotion render failed', e);
    }

    // 6) KPI / 발화 타임라인은 AnalyticsKit.Render에 위임 (스토어 기반)
    try {
        if (window.AnalyticsKit && window.AnalyticsKit.Render) {
            window.AnalyticsKit.Render.renderKPIs();
            window.AnalyticsKit.Render.renderTimeline();
        } else {
            // 간단 대체: KPI 카드 직접 채우기 (로그 기반)
            const kpiTalkSplit = document.getElementById('kpiTalkSplit');
            const kpiTailCount = document.getElementById('kpiTailCount');
            if (hasLogs) {
                const userChars = logs.reduce((sum, row) => sum + ((row.userMessage || '').length), 0);
                const personaChars = logs.reduce((sum, row) => sum + ((row.botAnswer || '').length), 0);
                const totalChars = userChars + personaChars;
                const userPct = totalChars ? Math.round((userChars / totalChars) * 100) : 0;
                const personaPct = totalChars ? Math.max(0, 100 - userPct) : 0;
                let tailCount = 0;
                try {
                    if (window.AnalyticsKit?.Store?.followupsByQuestion) {
                        tailCount = Object.values(window.AnalyticsKit.Store.followupsByQuestion)
                            .reduce((acc, num) => acc + Number(num || 0), 0);
                    } else {
                        tailCount = logs.filter((entry, idx) => idx > 0 && entry.questionIndex === logs[idx - 1].questionIndex).length;
                    }
                } catch (_) { tailCount = 0; }
                if (kpiTalkSplit) kpiTalkSplit.textContent = `[응답자 ${personaPct}% | 진행자 ${userPct}%]`;
                if (kpiTailCount) kpiTailCount.textContent = `${tailCount}회`;
            } else {
                if (kpiTalkSplit) kpiTalkSplit.textContent = '[응답자 0% | 진행자 0%]';
                if (kpiTailCount) kpiTailCount.textContent = '0회';
            }
        }
    } catch (e) {
        console.warn('KPI render fallback failed', e);
    }

    // 7) 말의 속도/언어습관(간단 통계)
    try {
        // 말의 속도: 사용자 발화 문자수 / 분 (평균)
        const userMsgs = logs.map(l => (l.userMessage || '')).filter(Boolean);
        let speedPct = 0;
        if (userMsgs.length && hasLogs) {
            const totalChars = userMsgs.reduce((a, b) => a + b.length, 0);
            const totalMinutes = Math.max(0.1, (logs[logs.length - 1].timestampEnd - logs[0].timestampStart) / 60000);
            const charsPerMin = totalChars / totalMinutes;
            // 기준: 200cpm -> 50% (arbitrary mapping), clamp
            speedPct = Math.round(Math.min(100, (charsPerMin / 300) * 100));
        }
        const speedBar = document.getElementById('speedBar');
        if (speedBar) speedBar.style.width = `${speedPct}%`;
        const speedLabel = document.querySelector('.speed-label');
        if (speedLabel) speedLabel.textContent = speedPct ? `${speedPct}% 말 속도` : (hasLogs ? '측정 불가' : '데이터 없음');
    } catch (e) {
        console.warn('speed calc failed', e);
    }
}
// ---------- 대체 함수 끝 ----------
document.addEventListener("DOMContentLoaded", () => {
    // ====== 로딩 애니메이션 CSS 추가 ======
    const style = document.createElement('style');
    style.textContent = `
    .loading-dots {
        display: flex;
        align-items: flex-end;
        height: 32px;
        gap: 8px;
        justify-content: center;
    }
    .loading-dots .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #bfc7d1;
        display: inline-block;
        animation: dot-bounce 1.2s infinite;
    }
    .loading-dots .dot:nth-child(1) { animation-delay: 0s; }
    .loading-dots .dot:nth-child(2) { animation-delay: 0.2s; }
    .loading-dots .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes dot-bounce {
        0%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-12px); }
    }
    `;
    document.head.appendChild(style);
    // 입력창 표시 버튼 기능
    const showInputBtn = document.getElementById('showInputBtn');
    const inputGroup = document.querySelector('#interview-page .input-group');
    if (showInputBtn && inputGroup) {
        showInputBtn.addEventListener('click', function() {
            inputGroup.classList.add('active');
            showInputBtn.style.display = 'none';
        });
    }
        // 입력창 숨김 버튼 기능
        const hideInputBtn = document.getElementById('hideInputBtn');
        if (hideInputBtn && inputGroup && showInputBtn) {
            hideInputBtn.addEventListener('click', function() {
                inputGroup.classList.remove('active');
                showInputBtn.style.display = 'flex';
            });
        }

    // 음성 인식 기능 (Web Speech API) - 상단 recognition 블록 제거, 아래 SR 자동 루프만 사용
    function showUserMessage(text) {
        const rightBox = document.getElementById('chating-right-box');
        const leftBox = document.getElementById('chating-left-box');
        // 질문 입력 시, 만약 답변 박스에 내용이 있으면 둘 다 chatbox로 올림
        if (rightBox.textContent.trim() || leftBox.textContent.trim()) {
            // 쌍으로 chatbox에 append
            if (rightBox.textContent.trim()) appendMessage(rightBox.textContent, 'user');
            if (leftBox.textContent.trim()) appendMessage(leftBox.textContent, 'bot');
            // 최신 박스 비움
            rightBox.textContent = '';
            leftBox.textContent = '';
        }
        // 새 질문 표시
        rightBox.textContent = text;
    }
    function showBotMessage(text) {
        const leftBox = document.getElementById('chating-left-box');
        if (!leftBox) return;
        leftBox.textContent = text;
    }

    // 답변 생성 중 로딩 애니메이션 표시
    function showBotLoading() {
        const leftBox = document.getElementById('chating-left-box');
        if (!leftBox) return;
        leftBox.innerHTML = `
        <div class="loading-dots">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
        </div>
    `;
    }
    // 퍼소나 슬라이드 관련
    let personaPageIndex = 0;
    const personaSlideContainer = document.getElementById("persona-container");
    const personaLeftBtn = document.getElementById("personaLeftBtn");
    const personaRightBtn = document.getElementById("personaRightBtn");

    function getPersonaCount() {
        return personaSlideContainer ? personaSlideContainer.children.length : 0;
    }

    function updatePersonaSlide() {
        if (personaSlideContainer) {
            const personas = personaSlideContainer.children;
            const visibleCount = 2; // 동시에 보여줄 개수

            console.log('Total personas:', personas.length);
            console.log('Current slide index:', personaPageIndex);

            // 모든 퍼소나에 슬라이드 트렌지션 적용
            for (let i = 0; i < personas.length; i++) {
                personas[i].style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                personas[i].style.opacity = '0';
                personas[i].style.transform = 'translateX(30px) scale(0.95)';
            }

            // 잠시 후 현재 윈도우의 퍼소나들 표시
            setTimeout(() => {
                // 모든 퍼소나 숨기기
                for (let i = 0; i < personas.length; i++) {
                    personas[i].style.display = 'none';
                }

                // 현재 슬라이딩 윈도우 범위 계산
                const startIndex = personaPageIndex;
                const endIndex = Math.min(startIndex + visibleCount, personas.length);

                console.log('Showing personas from', startIndex, 'to', endIndex - 1);

                // 윈도우 범위의 퍼소나들만 표시
                for (let i = startIndex; i < endIndex; i++) {
                    if (personas[i]) {
                        personas[i].style.display = 'block';
                        // 순차적으로 페이드인
                        setTimeout(() => {
                            personas[i].style.opacity = '1';
                            personas[i].style.transform = 'translateX(0px) scale(1)';
                        }, (i - startIndex) * 100 + 50);
                        console.log('Showing persona', i);
                    }
                }
            }, 200);
        }
    }

    if (personaLeftBtn) {
        personaLeftBtn.addEventListener("click", () => {
            console.log('Left button clicked, current page:', personaPageIndex);
            if (personaPageIndex > 0) {
                personaPageIndex--;
                console.log('Moving to page:', personaPageIndex);
                updatePersonaSlide();
            } else {
                console.log('Already at first page');
            }
        });
    }

    if (personaRightBtn) {
        personaRightBtn.addEventListener("click", () => {
            const totalPersonas = getPersonaCount();
            const visibleCount = 2;
            const maxIndex = Math.max(0, totalPersonas - visibleCount);
            console.log('Right button clicked, current index:', personaPageIndex, 'max index:', maxIndex);
            if (personaPageIndex < maxIndex) {
                personaPageIndex++;
                console.log('Moving to index:', personaPageIndex);
                updatePersonaSlide();
            } else {
                console.log('Already at last position');
            }
        });
    }

    // 모달 X버튼 클릭 시 닫기 (TDZ 방지: 선언 뒤에서 안전하게 참조)
    const apiKeyModalClose = document.querySelector('.api-key-modal-close');
    if (apiKeyModalClose) {
        const modal = document.getElementById("apiKeyModal");
        if (modal) {
            apiKeyModalClose.addEventListener('click', () => modal.classList.remove('active'));
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

    // ===== 이미지 프리로드/경로 유틸 (전역 스코프) =====
    const __preloadedImgs = new Set();

    function preloadImage(url) {
        if (!url || __preloadedImgs.has(url)) return;
        const im = new Image();
        im.onload = () => __preloadedImgs.add(url);
        im.src = url;
    }

    function deriveTalkGifPath(imgPath) {
        if (!imgPath || typeof imgPath !== 'string') return '';
        const m = imgPath.match(/^(.*)(\.[a-zA-Z0-9]+)$/);
        return m ? `${m[1]}-talk.gif` : `${imgPath}-talk.gif`;
    }

    //로딩스피너
    function showSpinner() {
        document.getElementById("loadingSpinner").style.display = "block";
    }

    function hideSpinner() {
        document.getElementById("loadingSpinner").style.display = "none";
    }

    // ---------------인트로애니메이션 관련
    gsap.registerPlugin(MotionPathPlugin);  // ⬅️ 꼭 있어야 함!

    const path = document.querySelector("#motion-path");  // ← id로 바꿔야 함
    const spans = document.querySelectorAll("#intro-logo span");
    const logo = document.getElementById("intro-logo");
    const svgWrapper = document.querySelector(".svg-wrapper");
    const svg = path.closest("svg");

    const tl = gsap.timeline();

    // 1. PRETALK 글자 한 글자씩 아래에서 등장
    tl.to(spans, {
        y: 0,
        opacity: 1,
        stagger: 0.08,
        duration: 0.7,
        ease: "power2.out"
    });

    // API 키 변경 버튼 및 모달 바깥 클릭 시 닫기 (GSAP 타임라인 밖에서 실행)
    if (changeApiKeyBtn && apiKeyModal) {
        changeApiKeyBtn.addEventListener('click', function (e) {
            apiKeyModal.classList.add('active');
        });
        apiKeyModal.addEventListener('mousedown', function (e) {
            if (e.target === apiKeyModal) {
                apiKeyModal.classList.remove('active');
            }
        });
    }

    // 2. 원형들이 path를 따라 튕기듯 나옴
    tl.add(() => {
        for (let i = 0; i < 10; i++) {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("r", "3");
            circle.setAttribute("fill", "white");
            circle.setAttribute("opacity", "0");
            svg.appendChild(circle);

            gsap.to(circle, {
                motionPath: {
                    path: path,
                    align: path,
                    alignOrigin: [0.5, 0.5],
                    start: 0,
                    end: 1
                },
                keyframes: [
                    { scale: 0.8, opacity: 1, duration: 0 },         // 시작 작고 보임
                    { scale: 1.4, opacity: 1, duration: 0.6 },       // 중간쯤 커짐
                    { scale: 1.0, opacity: 0, duration: 0.6 }        // 끝에서 사라짐
                ],
                duration: 1.2,
                ease: "power2.out",
                delay: i * 0.08,
                transformOrigin: "center center",
                onComplete: () => {
                    circle.remove(); // 애니 끝나면 제거
                }
            });


        }
    }, "+=0.2");

    // 3. 로고 + svg 위로 사라짐
    tl.to([logo, svgWrapper], {
        y: -150,
        duration: 1,
        ease: "power2.inOut",
        opacity: 0
    }, "+=0.5");

    // 4. 배경도 같이 사라짐 (겹쳐서 시작)
    tl.to("#intro", {
        opacity: 0,
        duration: 0.6,
        ease: "power2.inOut"
    }, "-=0.5");

    // 5. 인트로 화면 제거
    tl.set("#intro", { display: "none" });

    function enterMainPage() {
        inMain = true;
        cursor.classList.add("main-active"); // 흰색에서 → 파란색으로
    }
    // ------------------

    // 페이지 로드 시 API 키 입력 모달 표시
    if (!apiKey) {
        apiKeyModal.classList.add('active');
    }

    // API 키 저장 버튼
    saveApiKeyBtn.addEventListener("click", () => {
        const enteredKey = apiKeyInput.value.trim();
        if (enteredKey) {
            apiKey = enteredKey;
            localStorage.setItem("openai_api_key", apiKey);
            apiKeyModal.classList.remove('active');
        } else {
            alert("API 키를 입력해주세요!");
        }
    });

    // API 키 변경 버튼
    // (위에서 .classList.add('active')로 대체)

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
            messages: [{ role: "system", content: [{ text: `${interviewTitle}를 주제로 한 인터뷰는 ${interviewPurpose}을 목적으로 해야합니다. 이 인터뷰에서 해야하는는 질문을 ${questionNum}개 생성합니다. 인터뷰 질문은 인터뷰 순서에 맞게 구성되어야 하며, 개수는 user의 프롬프트에 기반합니다. 첫 질문은 인터뷰 주제에 대한 간단한 질문으로 시작합니다. 2번째 질문부터 본격적으로 목적에 맞게 질문을 작성하는데, 목적을 그대로 해석하지 말고, 목적으로부터 파생되는 심층적인 인사이트에 집중한 질문 생성을 기대합니다. 다음과 같은 이름을 부여한 인덱스로 내용을 채워 json 배열 타입으로 출력합니다. 이 양식 이외의 내용은 출력금지. json 형태로 출력하며, \n질문1\n질문2\n...\n이때, 숫자, 질문 인덱스 표시는 하지 않고, 텍스트만 큰 따옴표로 묶어서 넣고, 콤마를 삽입합니다. 그 밖의 내용은 절대 출력 금지. 개수를 정확히 준수합니다.`, type: "text" }] }],
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

                function saveCurrentInputValues() {
                    const inputs = document.querySelectorAll('.question-edit-input');
                    inputs.forEach(input => {
                        const idx = parseInt(input.dataset.index);
                        if (!isNaN(idx) && idx < questions.length) {
                            questions[idx] = input.value.trim();
                        }
                    });
                }

                // 질문 렌더링 함수 (삭제/추가/수정 후 재사용)
                function renderQuestions() {
                    resultContainer.innerHTML = questions.map((q, i) => `
                    <div class="question-edit-wrapper">
                      <span class="question-index-num">${i + 1}.</span>
                      <input type="text" class="question-edit-input"
                        value="${q.replace(/"/g, '&quot;')}"
                        data-index="${i}"
                        placeholder="${q === '' ? '내용을 입력하세요.' : ''}" />
                      <button class="question-delete-btn" type="button" data-index="${i}" title="삭제">
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                          <circle cx="16" cy="16" r="15" fill="#F8F9FB" stroke="#E7F0FF" stroke-width="2"/>
                          <rect x="10" y="15.25" width="12" height="1.5" rx="0.75" fill="#8F949B"/>
                        </svg>
                      </button>
                    </div>
                  `).join("");
                    // 질문 리스트도 갱신
                    const questionListEl = document.getElementById("questionList");
                    if (questionListEl) {
                        questionListEl.innerHTML = questions.map((q, i) => `<li>${i + 1}. ${q}</li>`).join("");
                        // 질문 리스트 갱신 후 팔로업 배지 갱신
                        try { updateFollowupBadges(); } catch (_) {}
                    }
                    // input width/삭제/추가 버튼 이벤트 재연결
                    setTimeout(() => {
                        const inputs = document.querySelectorAll('.question-edit-input');
                        inputs.forEach((input, index) => {
                            const adjustWidth = () => {
                                // 임시로 숨겨진 div를 만들어서 정확한 텍스트 길이 측정
                                const tempDiv = document.createElement('div');
                                tempDiv.style.position = 'absolute';
                                tempDiv.style.visibility = 'hidden';
                                tempDiv.style.whiteSpace = 'nowrap';
                                tempDiv.style.font = window.getComputedStyle(input).font;
                                tempDiv.textContent = input.value || input.placeholder;
                                document.body.appendChild(tempDiv);

                                const textWidth = tempDiv.offsetWidth;
                                document.body.removeChild(tempDiv);

                                // 모든 질문에 동일한 고정 여백 적용 (텍스트 길이 + 120px 고정 여백)
                                const extraPx = 120; // 고정 여백
                                const minWidthPx = Math.max(100, textWidth + extraPx);
                                const clampWidth = `clamp(7vw, ${(minWidthPx / 16)}rem, 35vw)`;

                                input.style.width = clampWidth;
                                const wrapper = input.closest('.question-edit-wrapper');
                                if (wrapper) wrapper.style.width = clampWidth;
                            };
                            input.addEventListener('input', adjustWidth);
                            adjustWidth();
                        });
                        // 삭제 버튼 이벤트
                        const deleteBtns = document.querySelectorAll('.question-delete-btn');
                        deleteBtns.forEach(btn => {
                            btn.addEventListener('click', function (e) {
                                e.preventDefault();
                                const idx = parseInt(this.getAttribute('data-index'));
                                questions.splice(idx, 1);
                                questionNum = questions.length;
                                const questionNumSpan = document.getElementById('count');
                                if (questionNumSpan) questionNumSpan.textContent = questionNum;
                                renderQuestions();
                            });
                        });
                        // 추가 버튼 이벤트
                        // (전역 플러스 버튼은 CSS에서 스타일링)
                    }, 50);
                }

                // 질문 생성 후 renderQuestions 호출하여 모든 질문 동일하게 처리
                renderQuestions();

                window.renderQuestions = renderQuestions;

                const questionListEl = document.getElementById("questionList");
                if (questionListEl) {
                    questionListEl.innerHTML = questions.map((q, i) => `<li>${i + 1}. ${q}</li>`).join("");
                }

                const nextBtn = document.getElementById("goToPersonaBtn");
                nextBtn.style.opacity = 0;
                nextBtn.style.display = "block";
                setTimeout(() => {
                    nextBtn.style.transition = "opacity 0.4s ease";
                    nextBtn.style.opacity = 1;
                }, 50);

                // 질문이 생성되면 다음 버튼 보여주기
                document.getElementById("goToPersonaBtn").style.display = "block";
                // 임베딩 준비(분류 정확도 향상)
                try {
                    // populate AnalyticsKit Store and embeddings when module available
                    if (window.AnalyticsKit && window.AnalyticsKit.NLP && typeof window.AnalyticsKit.NLP.ensurePreparedEmbeddings === 'function') {
                        await window.AnalyticsKit.NLP.ensurePreparedEmbeddings(questions);
                    } else if (typeof ensureQuestionEmbeddings === 'function') {
                        await ensureQuestionEmbeddings(apiKey, questions);
                    }
                } catch (e) { console.error('❌ ensureQuestionEmbeddings failed:', e); }
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

        // 퍼소나 생성 시작시 네비게이션 숨기기
        const personaNav = document.querySelector('.persona-navigation-con');
        if (personaNav) {
            personaNav.classList.remove('show');
        }

        // 균등 성비 배열 생성
        let genderArr = [];
        for (let i = 0; i < personaNum; i++) {
            genderArr.push(i % 2 === 0 ? "남성" : "여성");
        }
        // GPT API 호출 (퍼소나 생성)
        try {
            for (let i = 0; i < personaNum; i++) {
                const promptText = personaPrompts[i] || "";
                const gender = genderArr[i];
                const payload = {
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: [
                                {
                                    text: `인터뷰에서 사용할 ${i + 1}번째 퍼소나를 생성해주세요. 인터뷰 주제는 '${interviewTitle}'입니다. '${promptText ? `이 퍼소나는 반드시 ${promptText}를 기반으로 만들어야 하며, 지정된 내용의 누락이 없어야 합니다.` : ""}' 퍼소나는 현실적인 직업, 연령, 성격, 관심사를 가지고 있어야 하며, 인터뷰에서 논의될 주제와 관련성이 있어야 합니다. 반드시 성별은 '${gender}'로 설정하세요.\n이 양식으로 출력합니다:\n{\n"name": "퍼소나 성명",\n "gender": "퍼소나 성별", \n"age": "연령",\n"occupation": "직업",\n"personality": "성격",\n"interests": "관심사",\n"hobby": "취미",\n"speech": "언어습관",}\n그 밖의 내용은 출력하지 마세요. JSON 형식만 반환하세요. 이름은 성별에 맞추고, 반드시 한국식 3글자 이름으로 작성합니다. 직업은 '소속 부서 직급'순으로 기입하며, 예를 들어, '삼성증권 영업부 대리', '경원상사 재경부 부장' 입니다. 또는 프리랜서, 무직, 학생같은 형태도 상관 없습니다. \n 만약 지금 만드는 퍼소나가 3번째라면, 성격은 '매우 비관적', '공격적이고 꼬장꼬장함', '성질이 더럽고 짜증이 많음', '매우 소심하고 내성적' 등 과 같이 사회성이 매우 떨어지는 형태로 작성합니다. 3번째가 아닌 퍼소나는 평범하고 사회성 있는 성격으로 작성 합니다. \n 언어습관은 퍼소나의 말하기 방식을 정하는 것이며, 딱딱함/여유로움움, 내성적/외향적, 의기소침/자신감, 공격적/방어적, 단답형/장문형, 논리적/단편형에서, 각 선택지 한개씩 전부 반드시 골라야 함. 3의 배수 퍼소나라면 그에 맞춰 이야기 하기 까다로운 사용자를 만듭니다. \n 출력방식 json 타입을 꼭 지키도록 하며, {}괄호 전후로 아무것도 입력금지.`,
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

        // 이미지 경로 랜덤 선택 (중복 없이)
        const manImages = ["img/man-1.png", "img/man-2.png", "img/man-3.png"];
        const womanImages = ["img/woman-1.png", "img/woman-2.png"];
        let usedMan = [];
        let usedWoman = [];
        function getRandomImage(gender) {
            if (gender === "남성") {
                if (usedMan.length === manImages.length) usedMan = [];
                const available = manImages.filter(img => !usedMan.includes(img));
                const chosen = available[Math.floor(Math.random() * available.length)];
                usedMan.push(chosen);
                return chosen;
            } else {
                if (usedWoman.length === womanImages.length) usedWoman = [];
                const available = womanImages.filter(img => !usedWoman.includes(img));
                const chosen = available[Math.floor(Math.random() * available.length)];
                usedWoman.push(chosen);
                return chosen;
            }
        }
        // 이미지 프리로드/경로 유틸은 상위 스코프 선언 사용
        // persona-box 렌더링
        personaContainer.innerHTML = personaResults.map((p, index) => {
            const imgSrc = getRandomImage(p.gender);
            // 선택된 퍼소나 객체에 image 경로를 저장
            p.image = imgSrc;
            p.talkImage = deriveTalkGifPath(imgSrc);
            // 용량 큰 GIF는 미리 로드하여 끊김 방지
            preloadImage(p.talkImage);
            return `
                <div class="persona-box" id="persona-${index}" data-persona-index="${index}">
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
        // 선택 이벤트 연결
        document.querySelectorAll('.persona-box').forEach(box => {
            box.addEventListener('click', function () {
                // 이미 선택된 박스를 다시 클릭하면 선택 취소
                if (this.classList.contains('selected')) {
                    this.classList.remove('selected');
                } else {
                    // 다른 박스 선택 해제하고 현재 박스 선택
                    document.querySelectorAll('.persona-box').forEach(b => b.classList.remove('selected'));
                    this.classList.add('selected');
                }
            });
        });

        // 퍼소나 생성 후 네비게이션 보이기
        const personaNavigation = document.querySelector('.persona-navigation-con');
        if (personaNavigation) {
            personaNavigation.classList.add('show');
        }

        // 퍼소나 생성 후 인터뷰 버튼 보이기
        const interviewBtn = document.getElementById("goToInterviewBtn");
        if (interviewBtn) {
            interviewBtn.style.display = "flex";
            interviewBtn.style.opacity = "1";
        }

        // 퍼소나 생성 후 질문지 페이지의 다음 버튼 숨기기
        const personaBtn = document.getElementById("goToPersonaBtn");
        if (personaBtn) {
            personaBtn.style.display = "none";
            personaBtn.style.opacity = "0";
        }
    });



    // 다음 버튼 클릭 시 선택된 퍼소나로 인터뷰 진행
    // 질문지 생성에서 다음 버튼: 퍼소나 생성 탭으로 이동만

    // 선택된 퍼소나 정보를 전역 변수에 저장하여 인터뷰 진행 내내 활용
    let selectedPersonaGlobal = null;
    let selectedPersona = null; // 인터뷰 진행 중 사용할 퍼소나 정보
    let interviewDuration = null; // 인터뷰 진행 시간 저장
    // 인터뷰 좌측 말풍선 아바타 이미지 동기화 유틸
    function syncChatingLeftImage(persona, speaking = false) {
        const el = document.getElementById('chating-left-img');
        if (!el || !persona) return;
        const base = persona.image || (persona.gender === '여성' ? 'img/woman-1.png' : 'img/man-1.png');
        const talk = persona.talkImage || deriveTalkGifPath(base);
        // dataset에 보관
        el.dataset.base = base;
        el.dataset.talk = talk;
        // 미리 로드 시도
        try { preloadImage(talk); } catch (_) { }
        // speaking 상태에 따라 경로 적용, 실패시 base로 폴백
        el.onerror = function () { if (speaking) el.src = base; };
        el.src = speaking ? talk : base;
    }

    // chatbox에 퍼소나 정보 렌더링 함수
    function renderChatboxPersona(persona, duration) {
        const personaBox = document.querySelector('.chatbox-persona');
        if (!personaBox || !persona) return;
        // 기존 퍼소나 정보 제거
        personaBox.innerHTML = '';
        // 그룹별 div 생성
        const group1 = document.createElement('div');
        group1.className = 'persona-group';
        const img = document.createElement('img');
        img.className = 'persona-img chatbox-persona-img';
        if (persona.image) {
            img.src = persona.image;
        } else if (persona.gender === '남성') {
            img.src = 'img/man-1.png';
        } else if (persona.gender === '여성') {
            img.src = 'img/woman-1.png';
        } else {
            img.src = 'img/man-1.png';
        }
        img.alt = persona.name || '';
        group1.appendChild(img);
        const name = document.createElement('span');
        name.className = 'persona-name';
        name.textContent = persona.name || '';
        group1.appendChild(name);
        // 나이, 성별
        const group2 = document.createElement('div');
        group2.className = 'persona-group';
        [persona.age, persona.gender].forEach(v => {
            if (v) {
                const span = document.createElement('span');
                span.textContent = v;
                group2.appendChild(span);
            }
        });
        // 직업, 성격, 관심사(첫번째만), 언어습관(첫번째만)
        const group3 = document.createElement('div');
    group3.className = 'persona-group';
    const occupation = persona.occupation;
    const personality = persona.personality;
    const interests = persona.interests ? persona.interests.split(',')[0].trim() : '';
    const speech = persona.speech ? persona.speech.split(',')[0].trim() : '';
    [occupation, personality, interests, speech].forEach(v => {
        if (v) {
            const span = document.createElement('span');
            span.textContent = v;
            group3.appendChild(span);
        }
    });
    personaBox.appendChild(group1);
    personaBox.appendChild(group2);
    personaBox.appendChild(group3);
}

    document.getElementById('goToInterviewBtn').addEventListener('click', function () {
        const selectedBox = document.querySelector('.persona-box.selected');
        if (!selectedBox) {
            alert('퍼소나를 선택해주세요.');
            return;
        }
        const index = selectedBox.getAttribute('data-persona-index');
        selectedPersonaGlobal = personaResults[index]; // 전역 변수에 저장

        // 인터뷰 시간 설정 팝업 표시
        showInterviewTimeModal();
    });

    // 인터뷰 시간 설정 팝업 관련 함수들
    let timeModalInitialized = false;

    function showInterviewTimeModal() {
        const modal = document.getElementById('interviewTimeModal');
        modal.style.display = 'flex';

        // 한 번만 이벤트 리스너 초기화
        if (!timeModalInitialized) {
            initializeTimeModal();
            timeModalInitialized = true;
        }

        // 선택 상태만 초기화 (interviewDuration은 기존 값 유지)
        document.querySelectorAll('.time-option').forEach(opt => opt.classList.remove('selected'));
    }

    function initializeTimeModal() {
        // 시간 옵션 클릭 이벤트
        document.querySelectorAll('.time-option').forEach(option => {
            option.addEventListener('click', function () {
                // 기존 선택 해제
                document.querySelectorAll('.time-option').forEach(opt => opt.classList.remove('selected'));
                // 현재 선택 표시
                this.classList.add('selected');
                interviewDuration = parseInt(this.getAttribute('data-time'));
                console.log('선택된 시간:', interviewDuration); // 디버깅용
                // 전역 접근 가능하도록 노출
                try { window.interviewDuration = interviewDuration; } catch (_) { }
            });
        });

        // 확인 버튼 클릭
        document.getElementById('timeModalConfirm').addEventListener('click', function () {
            console.log('확인 버튼 클릭, interviewDuration:', interviewDuration); // 디버깅용
            if (!interviewDuration || interviewDuration <= 0) {
                alert('인터뷰 시간을 선택해주세요.');
                return;
            }
            hideInterviewTimeModal();
            startInterview();
        });

        // 취소 버튼 클릭
        document.getElementById('timeModalCancel').addEventListener('click', function () {
            hideInterviewTimeModal();
        });

        // 모달 외부 클릭 시 닫기
        document.getElementById('interviewTimeModal').addEventListener('click', function (e) {
            if (e.target === this) {
                hideInterviewTimeModal();
            }
        });
    }

    function hideInterviewTimeModal() {
        const modal = document.getElementById('interviewTimeModal');
        modal.style.display = 'none';
        // 선택 상태 초기화 (interviewDuration은 유지)
        document.querySelectorAll('.time-option').forEach(opt => opt.classList.remove('selected'));
    }

    function startInterview() {
        // 인터뷰 시작 전 가드: 질문/임베딩 준비 확인
        if (!Array.isArray(questions) || questions.length === 0) {
            alert('먼저 질문을 생성해주세요.');
            return;
        }
        // Accept embeddings prepared either in the local _qEmbeddings or in AnalyticsKit.Store.qEmbeddings
        const akStoreEmb = window.AnalyticsKit && window.AnalyticsKit.Store ? window.AnalyticsKit.Store.qEmbeddings : null;
        const localEmb = _qEmbeddings;
        const embeddingsReady = (Array.isArray(localEmb) && localEmb.length > 0) || (Array.isArray(akStoreEmb) && akStoreEmb.length > 0);
        if (!embeddingsReady) {
            alert('질문 임베딩을 준비 중입니다. 잠시 후 다시 시도해주세요.');
            console.log('embeddings check -> _qEmbeddings:', _qEmbeddings, 'AnalyticsKit.Store.qEmbeddings:', akStoreEmb);
            // 질문 임베딩 생성 함수가 존재하는지 로그로 안내
            if (typeof ensureQuestionEmbeddings !== 'function' && !(window.AnalyticsKit && window.AnalyticsKit.NLP && typeof window.AnalyticsKit.NLP.ensurePreparedEmbeddings === 'function')) {
                console.error('질문 임베딩이 준비되지 않았습니다. ensureQuestionEmbeddings 또는 AnalyticsKit.NLP.ensurePreparedEmbeddings가 정의되어 있어야 합니다.');
            }
            return;
        }
        // 선택된 퍼소나를 인터뷰용 변수에 할당
        selectedPersona = selectedPersonaGlobal;

        if (!selectedPersona) {
            alert('퍼소나를 선택해주세요.');
            return;
        }

        console.log('인터뷰 시작 - 선택된 퍼소나:', selectedPersona); // 디버깅용

        // 현재 스크롤 위치 저장
        const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;

        // body의 overflow 설정 임시 저장
        const originalOverflow = document.body.style.overflow;

        // 스크롤 이동 방지를 위해 body 고정
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${currentScrollY}px`;
        document.body.style.width = '100%';

        // 스크롤 이동 방지를 위해 click() 대신 직접 탭 전환 로직 실행
        // activeStyle.js의 탭 전환 로직을 직접 호출
        const navItems = Array.from(document.querySelectorAll("#nav-bar > div"));
        const interviewTabIndex = 2; // btn-interview는 3번째 탭 (0: preset, 1: persona, 2: interview)

        // 기존 활성 탭 비활성화
        navItems.forEach(nav => nav.classList.remove("nav-active"));

        // 인터뷰 탭 활성화
        const interviewTab = document.querySelector('.btn-interview');
        if (interviewTab) {
            interviewTab.classList.add("nav-active");

            // 아이콘 색상 변경
            document.querySelectorAll(".nav-img svg").forEach(svg => {
                svg.querySelector("path").setAttribute("fill", "#CDD1D6");
            });

            const svg = interviewTab.querySelector(".nav-img svg");
            if (svg) {
                svg.querySelector("path").setAttribute("fill", "#5B5E63");
            }
        }

        // 사이드바 전환 (스크롤 이동 없이)
        const subItems = document.querySelectorAll(".sub-upper .container-children");
        const currentActive = document.querySelector(".sub-activate");

        if (currentActive) {
            currentActive.classList.remove("sub-activate");
            currentActive.classList.add("sub-inactive");
            currentActive.style.display = "none";
        }

        // 인터뷰 사이드바 활성화
        if (subItems[interviewTabIndex]) {
            const interviewSidebar = subItems[interviewTabIndex];
            interviewSidebar.style.display = "flex";
            interviewSidebar.classList.remove("sub-inactive");
            interviewSidebar.classList.add("sub-activate");
        }

        // 메인 페이지 전환 (스크롤 이동 없이)
        const pages = document.querySelectorAll("#result .page");
        pages.forEach((page, index) => {
            if (index === interviewTabIndex) {
                page.style.display = "block";
                page.style.opacity = 1;
            } else {
                page.style.display = "none";
                page.style.opacity = 0;
            }
        });

        // 짧은 시간 후 body 스타일 복원
        setTimeout(() => {
            document.body.style.overflow = originalOverflow || '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            window.scrollTo(0, currentScrollY);
        }, 100);

        // 인터뷰 시작 시 chatbox에 퍼소나 정보 출력 (div 구조)
        renderChatboxPersona(selectedPersonaGlobal, interviewDuration);
        // 선택된 퍼소나의 talk GIF를 한 번 더 예열
        if (selectedPersonaGlobal?.talkImage) { try { preloadImage(selectedPersonaGlobal.talkImage); } catch (_) { } }

        // 사이드바 강제 전환 함수
        function forceSidebarSwitch() {
            console.log('forceSidebarSwitch 시작');

            // 모든 사이드바 섹션을 비활성화
            document.querySelectorAll('.container-children').forEach(container => {
                container.classList.remove('sub-activate');
                container.classList.add('sub-inactive');
            });

            // 인터뷰 사이드바만 활성화 (.container-children.sub-interview 선택)
            const interviewSidebar = document.querySelector('.container-children.sub-interview');
            console.log('인터뷰 사이드바 요소:', interviewSidebar);

            if (interviewSidebar) {
                interviewSidebar.classList.remove('sub-inactive');
                interviewSidebar.classList.add('sub-activate');
                console.log('인터뷰 사이드바 강제 활성화됨');

                // 클래스 변경 후 상태 확인
                console.log('사이드바 클래스:', interviewSidebar.className);
                console.log('사이드바 스타일 display:', window.getComputedStyle(interviewSidebar).display);
                console.log('사이드바 스타일 visibility:', window.getComputedStyle(interviewSidebar).visibility);

                // DOM에서 직접 요소 찾기
                const allSetTimeElements = document.querySelectorAll('[id="set-time"]');
                const allLeftTimeElements = document.querySelectorAll('[id="left-time"]');
                console.log('DOM에서 찾은 set-time 요소들:', allSetTimeElements);
                console.log('DOM에서 찾은 left-time 요소들:', allLeftTimeElements);

                // 즉시 요소들 확인
                const setTimeElement = document.getElementById('set-time');
                const leftTimeElement = document.getElementById('left-time');
                console.log('강제 전환 후 요소 체크:', setTimeElement, leftTimeElement);
            } else {
                console.error('인터뷰 사이드바를 찾을 수 없음');
            }
        }

        // 요소가 실제로 화면에 나타날 때까지 기다리는 함수
        function waitForElements() {
            const setTimeElement = document.getElementById('set-time');
            const leftTimeElement = document.getElementById('left-time');

            console.log('요소 체크:', setTimeElement, leftTimeElement); // 디버깅용

            if (setTimeElement && leftTimeElement) {
                // 요소들이 존재하면 타이머 설정
                console.log('요소들이 준비됨, 타이머 설정 시작'); // 디버깅용
                setupInterviewTimer();
            } else {
                // 아직 요소가 준비되지 않았으면 사이드바 강제 전환 후 다시 체크
                console.log('요소가 아직 준비되지 않음, 사이드바 강제 전환 후 재시도'); // 디버깅용
                forceSidebarSwitch();
                setTimeout(waitForElements, 300);
            }
        }

        // 즉시 사이드바 강제 전환
        forceSidebarSwitch();

        // 사이드바 전환 후 요소 체크 시작
        setTimeout(waitForElements, 100);

        // 이후 인터뷰 진행 로직에서 selectedPersonaGlobal과 interviewDuration 사용 가능
    }

    // 인터뷰 타이머 관련 변수들
    let interviewTimer = null;
    let remainingSeconds = 0;

    function setupInterviewTimer() {
        // 설정 시간 유효성 검사
        if (!interviewDuration || interviewDuration <= 0) {
            console.error('유효하지 않은 인터뷰 시간:', interviewDuration);
            alert('인터뷰 시간이 제대로 설정되지 않았습니다.');
            return;
        }

        console.log('타이머 설정 중, interviewDuration:', interviewDuration); // 디버깅용

        // 설정 시간을 초 단위로 변환
        remainingSeconds = interviewDuration * 60;

        console.log('remainingSeconds:', remainingSeconds); // 디버깅용

        // DOM에서 직접 모든 요소 찾기
        const allElements = document.querySelectorAll('*');
        let foundSetTime = null;
        let foundLeftTime = null;

        allElements.forEach(el => {
            if (el.id === 'set-time') foundSetTime = el;
            if (el.id === 'left-time') foundLeftTime = el;
        });

        console.log('전체 DOM 검색 결과 - set-time:', foundSetTime, 'left-time:', foundLeftTime);

        // querySelector로도 시도
        const setTimeByQuery = document.querySelector('#set-time');
        const leftTimeByQuery = document.querySelector('#left-time');
        console.log('querySelector 결과 - set-time:', setTimeByQuery, 'left-time:', leftTimeByQuery);

        // 설정 시간 표시 (MM:SS 형식)
        const setTimeElement = foundSetTime || setTimeByQuery || document.getElementById('set-time');
        if (setTimeElement) {
            const setTime = formatTime(remainingSeconds);
            setTimeElement.textContent = setTime;
            console.log('설정 시간 표시됨:', setTime); // 디버깅용
        } else {
            console.error('set-time 요소를 찾을 수 없습니다');
            // 직접 생성해서 삽입해보기
            tryCreateTimeElements();
        }

        // 초기 남은 시간도 설정 시간과 동일하게 표시
        const leftTimeElement = foundLeftTime || leftTimeByQuery || document.getElementById('left-time');
        if (leftTimeElement) {
            const leftTime = formatTime(remainingSeconds);
            leftTimeElement.textContent = leftTime;
            console.log('남은 시간 표시됨:', leftTime); // 디버깅용
        } else {
            console.error('left-time 요소를 찾을 수 없습니다');
        }

        // 타이머 시작
        startTimer();
    }

    // 요소가 없을 때 직접 생성하는 함수
    function tryCreateTimeElements() {
        const interviewTime = document.querySelector('.interview-time');
        if (interviewTime) {
            console.log('interview-time 컨테이너 찾음, 요소 강제 생성 시도');

            // set-time이 없으면 생성
            if (!document.getElementById('set-time')) {
                const setTimeP = document.createElement('p');
                setTimeP.id = 'set-time';
                setTimeP.textContent = '00:00';
                const setDiv = interviewTime.querySelector('.interview-set');
                if (setDiv) setDiv.appendChild(setTimeP);
            }

            // left-time이 없으면 생성
            if (!document.getElementById('left-time')) {
                const leftTimeP = document.createElement('p');
                leftTimeP.id = 'left-time';
                leftTimeP.textContent = '00:00';
                const leftDiv = interviewTime.querySelector('.interview-left');
                if (leftDiv) leftDiv.appendChild(leftTimeP);
            }
        }
    }

    function startTimer() {
        if (interviewTimer) {
            clearInterval(interviewTimer);
        }

        // 남은 시간이 0 이하면 타이머 시작하지 않음
        if (remainingSeconds <= 0) {
            console.error('유효하지 않은 남은 시간:', remainingSeconds);
            return;
        }

        console.log('타이머 시작, 초기 remainingSeconds:', remainingSeconds); // 디버깅용

        interviewTimer = setInterval(() => {
            remainingSeconds--;

            console.log('타이머 틱, remainingSeconds:', remainingSeconds); // 디버깅용

            // 남은 시간 업데이트
            const leftTimeElement = document.getElementById('left-time');
            if (leftTimeElement) {
                leftTimeElement.textContent = formatTime(remainingSeconds);
            } else {
                console.error('타이머 업데이트 중 left-time 요소를 찾을 수 없습니다');
            }

            // 시간이 끝나면
            if (remainingSeconds <= 0) {
                clearInterval(interviewTimer);
                interviewTimer = null;
                console.log('타이머 종료, 인터뷰 종료 모달 표시'); // 디버깅용
                showInterviewEndModal();
            }
        }, 1000);
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // endInterview 전역 함수 없이 버튼 핸들러에서 직접 처리하는 패턴 사용 (module_cham.js 스타일)

    function showInterviewEndModal() {
        // 인터뷰 종료 모달 생성 (세련된 디자인)
        const modal = document.createElement('div');
        modal.id = 'interviewEndModal';
        modal.style.cssText = `
            display: flex;
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(30, 34, 54, 0.35);
            z-index: 10001;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(6px) saturate(1.2);
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: rgba(255,255,255,0.92);
            padding: 2.5rem 2.2rem 2.2rem 2.2rem;
            border-radius: 18px;
            box-shadow: 0 8px 32px rgba(30,34,54,0.18);
            text-align: center;
            max-width: 420px;
            width: 92vw;
            position: relative;
            animation: modalPop 0.4s cubic-bezier(.7,-0.4,.3,1.4);
        `;

        // 아이콘 및 애니메이션 추가
        modalContent.innerHTML = `
            <div style="margin-bottom:1.2rem;">
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style="filter:drop-shadow(0 2px 8px #357AFF22);">
                    <circle cx="28" cy="28" r="28" fill="#E7F0FF"/>
                    <path d="M18 28L26 36L38 22" stroke="#357AFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <h3 style="margin-bottom: 1.1rem; color: #2456b3; font-size: 1.45rem; font-weight:600; letter-spacing:-0.5px;">인터뷰가 종료되었습니다</h3>
            <div style="margin-bottom:2.1rem; color:#444; font-size:1.08rem; line-height:1.6;">수고하셨습니다!<br>아래 버튼을 눌러 분석 결과를 확인하세요.</div>
            <button id="goToAnalysisBtn" style="
                padding: 0.85rem 2.1rem;
                background: linear-gradient(90deg,#357AFF 0%,#2456b3 100%);
                color: #fff;
                border: none;
                border-radius: 10px;
                font-size: 1.08rem;
                font-weight: 500;
                box-shadow: 0 2px 8px rgba(53,122,255,0.10);
                cursor: pointer;
                transition: background 0.2s, box-shadow 0.2s;
            ">분석 결과 보러가기</button>
            <style>
            @keyframes modalPop {
                0% { transform: scale(0.7); opacity: 0; }
                70% { transform: scale(1.08); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
            }
            </style>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // 분석 페이지로 이동 버튼 이벤트
        document.getElementById('goToAnalysisBtn').addEventListener('click', function () {
            // 1) 모달 제거
            document.body.removeChild(modal);
            // 2) 분석 탭으로 전환
            document.querySelector('.btn-analysis')?.click();
            // 3) 대시보드 렌더 트리거
            if (typeof renderAnalysisDashboard === 'function') {
                try {
                    renderAnalysisDashboard({
                        targetMinutes: interviewDuration || 20,
                        highlightQuestionIndex: lastIndex || null
                    });
                } catch (e) { console.warn('renderAnalysisDashboard failed:', e); }
            } else if (typeof window.renderAnalysis === 'function') {
                try { window.renderAnalysis(); } catch (e) { console.warn('renderAnalysis fallback failed', e); }
            } else if (window.AnalyticsKit?.Render) {
                try {
                    window.AnalyticsKit.Render.renderKPIs();
                    window.AnalyticsKit.Render.renderTimeline();
                    window.AnalyticsKit.Emotions?.renderEmotionalCards?.('#feedbackList');
                } catch (e) { console.warn('AnalyticsKit fallback render failed:', e); }
            }
        });
    }



    //아래는 음성처리부분/////////////////////////////////////////////////////////////////////////////////////////////////////////

    const apiUrl = "https://api.openai.com/v1/chat/completions";
    const modelId = "ft:gpt-4o-2024-08-06:chamkkae:chamkkae-v3a:AmwkrRHc";

    const chatbox = document.getElementById('chatbox');

    // "종료" 버튼 클릭 시 인터뷰 종료 모달 표시
    const endBtn = document.getElementById('endInterviewBtn');
    if (endBtn) {
        endBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // 이미 떠 있으면 중복 생성 방지
            if (!document.getElementById('interviewEndModal')) {
                showInterviewEndModal();
            }
        });
    }

    // 채팅창 하단 고정: 변화가 있을 때마다 자동 스크롤 (페이지 전체가 아닌 컨테이너 내부에서만 스크롤)
    function __scrollChatToBottom() {
        if (!chatbox) return;
        try {
            // 우선 컨테이너 내부 스크롤
            chatbox.scrollTop = chatbox.scrollHeight;
            // 마지막 메시지를 기준으로 보이도록 보장
            const last = chatbox.lastElementChild;
            if (last && typeof last.scrollIntoView === 'function') {
                // 가장 가까운 스크롤 가능한 조상(=chatbox) 기준으로만 이동
                last.scrollIntoView({ block: 'end', inline: 'nearest' });
            }
            // 페이지 전체 스크롤은 더 이상 수행하지 않음
        } catch (_) { }
    }
    function __scheduleChatAutoScroll() {
        if (!chatbox) return;
        // 레이아웃/이미지 로드/폰트 적용 지연 등을 고려한 다단계 스케줄링
        requestAnimationFrame(() => {
            __scrollChatToBottom();
            setTimeout(__scrollChatToBottom, 0);
            setTimeout(__scrollChatToBottom, 80);
        });
    }
    if (chatbox) {
        const obs = new MutationObserver(() => __scheduleChatAutoScroll());
        obs.observe(chatbox, { childList: true, subtree: true });
        // 이미지 로드로 인해 높이가 변할 때도 추적
        chatbox.addEventListener('load', (e) => {
            if (e?.target?.tagName === 'IMG') __scheduleChatAutoScroll();
        }, true);
    }

    const audioElement = new Audio(); // 오디오 재생을 위한 HTMLAudioElement

    // ====== TTS (OpenAI /v1/audio/speech) ======
    let ttsUnlocked = false;

    // 사용자 제스처 한 번으로 오디오 정책 해제
    function unlockAudioOnce() {
        if (ttsUnlocked) return;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) { ttsUnlocked = true; return; }
            const ctx = new AC();
            const buf = ctx.createBuffer(1, 1, 22050);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(ctx.destination);
            if (ctx.state === 'suspended') ctx.resume();
            src.start(0);
            ttsUnlocked = true;
        } catch (_) {
            ttsUnlocked = true;
        }
    }

    // 주요 버튼에 1회 바인딩(이미 존재하는 요소 id 기준)
    ;['micButton', 'sendButton', 'generate-btn', 'persona-generate-btn', 'goToInterviewBtn']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', unlockAudioOnce, { once: true });
        });

    // 퍼소나 기반 음성 합성
    async function speakTextPersona(text, persona) {
        if (!text) return;
        const key = (typeof apiKey === 'string' && apiKey) ? apiKey : (apiKeyInput?.value?.trim() || '');
        if (!key) return;

        // 인식 중단(자기 음성 캡처 방지)
        try { if (SR && isListening) SR.stop(); } catch (_) { }

        isSpeaking = true;
        setMicStatus('말하는 중');
        try { if (window.AnalyticsKit && window.AnalyticsKit.Timeline && typeof window.AnalyticsKit.Timeline.personaSpeakStart === 'function') window.AnalyticsKit.Timeline.personaSpeakStart(); } catch (_) { }
        // 좌측 아바타 이미지를 talk GIF로 전환
        try { syncChatingLeftImage(persona || selectedPersona, true); } catch (_) { }

        // 성별에 따른 예시 보이스 매핑(필요시 수정)
        let voice = 'coral';  // 기본
        const g = String(persona?.gender || '').trim();
        if (/(여자|여성|female|woman)/i.test(g)) voice = 'alloy';
        if (/(남자|남성|male|man)/i.test(g)) voice = 'echo';

        // 스타일 지시문
        let instructions = '자연스럽고 친근한 톤으로 말해주세요.';
        if (persona?.speech) instructions += ` ${persona.speech}`;
        const ageNum = Number(persona?.age);
        if (!Number.isNaN(ageNum)) {
            if (ageNum < 30) instructions += ' 젊은 목소리.';
            else if (ageNum < 50) instructions += ' 중년 목소리.';
            else instructions += ' 노년 목소리.';
        }

        const body = {
            model: 'gpt-4o-mini-tts',
            input: text,
            voice,
            instructions,
            response_format: 'wav',
            speed: 1.0
        };

        try {
            const res = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                body: JSON.stringify(body)
            });
            if (!res.ok) throw new Error(`TTS API 오류: ${res.status}`);

            const audioBlob = await res.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            // 재생 전에 한 번 unlock
            unlockAudioOnce();

            audioElement.preload = 'auto';
            audioElement.src = audioUrl;

            audioElement.onended = () => { cleanup(); };
            audioElement.onerror = () => { cleanup(); };

            try { await audioElement.play(); }
            catch (e) { cleanup(/*silent=*/true); }

            function cleanup(silent = false) {
                isSpeaking = false;
                setMicStatus('듣는 중');
                try { if (window.AnalyticsKit && window.AnalyticsKit.Timeline && typeof window.AnalyticsKit.Timeline.personaSpeakEnd === 'function') window.AnalyticsKit.Timeline.personaSpeakEnd(text); } catch (_) { }
                // 말하기 종료 시 정적 이미지로 복귀
                try { syncChatingLeftImage(persona || selectedPersona, false); } catch (_) { }
                try { URL.revokeObjectURL(audioUrl); } catch (_) { }
                if (!silent && !isListening && !isPending) { try { safeStart(); } catch (_) { } }
            }
        } catch (e) {
            isSpeaking = false;
            setMicStatus('듣는 중');
            try { if (window.AnalyticsKit && window.AnalyticsKit.Timeline && typeof window.AnalyticsKit.Timeline.personaSpeakEnd === 'function') window.AnalyticsKit.Timeline.personaSpeakEnd(text); } catch (_) { }
            try { syncChatingLeftImage(persona || selectedPersona, false); } catch (_) { }
            if (!isListening && !isPending) { try { safeStart(); } catch (_) { } }
        }
    }

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

    // ===== WS/Python server: disabled =====
    let socket = null; // legacy guard
    function connectWebSocket() {
        // intentionally disabled – no external WS server
        return;
    }
    // 안전 가드: 혹시 남아있는 send 호출을 무시
    function __legacySocketSendSilently__(payload) {
        /* no-op */
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
        // fade-in 애니메이션 효과 추가
        if (sender === 'bot') {
            const wrapper = document.createElement('div');
            wrapper.className = 'message-wrapper';

            const nameTag = document.createElement('div');
            nameTag.className = 'persona-name-tag';
            if (selectedPersona && selectedPersona.name) {
                nameTag.textContent = selectedPersona.name.slice(-2);
            } else {
                nameTag.textContent = "퍼소나";
            }

            const messageElement = document.createElement('div');
            messageElement.className = 'message bot';
            messageElement.textContent = message;

            // 애니메이션 초기 상태
            wrapper.style.opacity = '0';
            wrapper.style.transition = 'opacity 0.5s cubic-bezier(0.4,0,0.2,1)';

            wrapper.appendChild(nameTag);
            wrapper.appendChild(messageElement);
            chatbox.appendChild(wrapper);
            // 트리거
            setTimeout(() => { wrapper.style.opacity = '1'; }, 10);
        } else {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${sender}`;
            messageElement.textContent = message;
            // 애니메이션 초기 상태
            messageElement.style.opacity = '0';
            messageElement.style.transition = 'opacity 0.5s cubic-bezier(0.4,0,0.2,1)';
            chatbox.appendChild(messageElement);
            setTimeout(() => { messageElement.style.opacity = '1'; }, 10);
        }
        __scheduleChatAutoScroll();
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
        __scheduleChatAutoScroll();
    }

    let interviewLog = []; // 인터뷰 Q&A 기록용
    // 외부 가드/호출을 위해 전역에 노출 (초기 자동 렌더 차단용 등)
    window.interviewLog = interviewLog;
    let sendStartTime = null;

    // ===== Final Guide: aggregation helpers =====
    // 최종 질문지 편집 상태
    let finalQuestions = [];
    window.finalQuestions = finalQuestions;
    let currentEditContext = 'base'; // 'base' | 'final'
    function getInterviewPurpose() {
        const v = (document.getElementById('interviewFor')?.value || '').trim();
        return v || '인터뷰 목적 미입력';
    }
    function getInterviewSubject() {
        const v = (document.getElementById('interviewTitle')?.value || '').trim();
        return v || '인터뷰 주제 미입력';
    }
    function getExpectedDurationLabel() {
        try {
            const set = document.getElementById('set-time')?.textContent?.trim();
            if (set) return set;
        } catch (_) {}
        const m = (window.interviewDuration || 20);
        return `${m}분`;
    }
    function collectOriginalQuestions() {
        // 기본 생성 질문 배열
        if (Array.isArray(questions) && questions.length) return questions.slice();
        // 폴백: 화면의 question-container input들
        const inputs = Array.from(document.querySelectorAll('#question-container .question-edit-input'));
        return inputs.map(i => i.value.trim()).filter(Boolean);
    }
    function collectFollowupAttempts() {
        const S = window.AnalyticsKit && window.AnalyticsKit.Store;
        const followupCounts = S?.followupsByQuestion || {};
        // interviewLog에서 질문 index별로 추정 팔로업 텍스트 수집
        const byIdx = {};
        (window.interviewLog || []).forEach(r => {
            const idx = r.questionIndex || 0;
            if (!idx) return;
            if (!byIdx[idx]) byIdx[idx] = [];
            const t = (r.userMessage || '').trim();
            if (t) byIdx[idx].push(t);
        });
        return { followupCounts, byIdx };
    }
    function mergeFinalQuestions() {
        const base = collectOriginalQuestions();
        const { byIdx } = collectFollowupAttempts();
        const merged = [];
        base.forEach((q, i) => {
            merged.push(q);
            const idx = i + 1;
            const tails = (byIdx[idx] || []).filter(t => /파생 질문/.test(t));
            // 대표 팔로업을 최대 1~2개까지만 추출해 인접 배지로 표시(텍스트는 본문에 병합하지 않음)
            if (tails.length) {
                merged[merged.length - 1] = {
                    text: q,
                    followups: tails.slice(0, 2)
                };
            }
        });
        // Add ad-hoc/new questions from logs
        try {
            const logs = (window.interviewLog || []);
            const newQs = [];
            const seen = new Set(base.map(s=>s.trim()));
            logs.forEach(r => {
                const u = (r.userMessage || '').trim();
                if (!u || !/[?？]$/.test(u)) return;
                const qLabel = r.question || '';
                const idx = r.questionIndex || 0;
                const outOfRange = !idx || (Array.isArray(base) && (idx < 1 || idx > base.length));
                const isDerived = /파생 질문/.test(qLabel || '');
                if ((outOfRange || isDerived) && !seen.has(u)) {
                    seen.add(u);
                    newQs.push({ text: u, type: 'new' });
                }
            });
            if (newQs.length) merged.push(...newQs);
        } catch (_) {}
        return merged;
    }
    function deriveNotesFromDashboard() {
        // 현재 대시보드 데이터에서 문제 신호를 간단히 요약
        const notes = [];
        try {
            const S = window.AnalyticsKit?.Store;
            const talkRatio = S?.counters?.talkRatio || 0;
            if (talkRatio && talkRatio > 0.65) notes.push('인터뷰어 발화가 많은 편입니다. 개방형 질문과 경청 비중을 높이세요.');
        } catch (_) {}
        try {
            const el = document.querySelector('#emotionList');
            const src = el?.dataset?.emotionSource || '';
            if (src) {
                // 감정 카드 결과 기반 간단 요약
                const text = el.textContent || '';
                if (/부정|불편|거부|불쾌/.test(text)) notes.push('부정적 반응 신호가 있었습니다. 공감/인정 표현을 우선하세요.');
            }
        } catch (_) {}
        try {
            const S = window.AnalyticsKit?.Store;
            const f = S?.followupsByQuestion || {};
            const dense = Object.values(f).some(n => n >= 2);
            if (dense) notes.push('특정 질문에서 꼬리질문이 집중되었습니다. 시간 배분을 조정하세요.');
        } catch (_) {}
        if (!notes.length) notes.push('별도의 주의사항은 없습니다. 계획한 흐름대로 진행하세요.');
        return notes;
    }
    function renderFinalGuide() {
        const briefEl = document.getElementById('briefCards');
        const listEl = document.getElementById('finalQuestionsList');
        if (!briefEl || !listEl) return;
        const subject = getInterviewSubject();
        const purpose = getInterviewPurpose();
        const duration = getExpectedDurationLabel();
        const notes = deriveNotesFromDashboard();
        const cardTpl = (iconUrl, label, value) => (
            `<div class="brief-card">
                <div class="card-surface"></div>
                <div class="card-body">
                    <img src="${iconUrl}" alt=""/>
                    <div class="label">${label}</div>
                    <div class="value">${value}</div>
                </div>
            </div>`
        );
        briefEl.innerHTML = [
            cardTpl('img/ico_topic.png', '인터뷰 주제', subject),
            cardTpl('img/ico_purpose.png', '인터뷰 목적', purpose),
            cardTpl('img/ico_time.png', '예상 진행 시간', duration),
            cardTpl('img/ico_note.png', '주의사항', notes[0] || '-')
        ].join('');

        // 최종 질문지(편집 가능) 렌더: 저장된 편집본이 있으면 텍스트만 덮어쓰기
        const mergedBase = mergeFinalQuestions();
        let merged = mergedBase;
        try {
            const saved = localStorage.getItem('finalQuestions');
            if (saved) {
                const restored = JSON.parse(saved);
                if (Array.isArray(restored) && restored.length) {
                    // overlay
                    merged = mergedBase.map((item, i) => {
                        const sv = restored[i];
                        if (sv == null) return item;
                        if (typeof item === 'string') return String(sv ?? '');
                        return { ...item, text: String(sv ?? '') };
                    });
                    if (restored.length > mergedBase.length) {
                        for (let i = mergedBase.length; i < restored.length; i++) {
                            merged.push(String(restored[i] ?? ''));
                        }
                    }
                }
            }
        } catch(err) { /* ignore */ }
        renderFinalQuestionsEditable(merged);
    }

    function renderFinalQuestionsEditable(merged) {
        const listEl = document.getElementById('finalQuestionsList');
        if (!listEl) return;
        // 편집 배열 준비
        finalQuestions = merged.map(item => typeof item === 'string' ? item : (item.text || ''));
        window.finalQuestions = finalQuestions;
        // 렌더
        listEl.innerHTML = merged.map((item, i) => {
            const text = (typeof item === 'string') ? item : (item.text || '');
            const fBadge = (item && item.followups && item.followups.length) ? `<span class=\"badge\">팔로업 ${item.followups.length}</span>` : '';
            const nBadge = (item && item.type === 'new') ? `<span class=\"badge\" style=\"background:#EAF5E6;color:#2F8A4C;border-color:#D2EDDC;\">신규</span>` : '';
            return `
                <li>
                    <div class="question-edit-wrapper" data-context="final">
                        <input type="text" class="question-edit-input" data-index="${i}" value="${text.replace(/"/g, '&quot;')}" placeholder="${text ? '' : '내용을 입력하세요.'}" />
                        <button class="question-delete-btn" type="button" data-index="${i}" title="삭제">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                                <circle cx="16" cy="16" r="15" fill="#F8F9FB" stroke="#E7F0FF" stroke-width="2"/>
                                <rect x="10" y="15.25" width="12" height="1.5" rx="0.75" fill="#8F949B"/>
                            </svg>
                        </button>
                        ${fBadge}${nBadge}
                    </div>
                </li>`;
        }).join('');
        bindFinalQuestionsEvents();
    }

    function bindFinalQuestionsEvents() {
        const container = document.getElementById('finalQuestionsList');
        if (!container) return;
        // 입력 가변 폭/동기화
        const inputs = container.querySelectorAll('.question-edit-input');
        inputs.forEach(input => {
            const adjustWidth = () => {
                const tempDiv = document.createElement('div');
                tempDiv.style.position = 'absolute';
                tempDiv.style.visibility = 'hidden';
                tempDiv.style.whiteSpace = 'nowrap';
                tempDiv.style.font = window.getComputedStyle(input).font;
                tempDiv.textContent = input.value || input.placeholder || '';
                document.body.appendChild(tempDiv);
                const textWidth = tempDiv.offsetWidth; document.body.removeChild(tempDiv);
                const extraPx = 120; const minWidthPx = Math.max(100, textWidth + extraPx);
                const clampWidth = `clamp(7vw, ${(minWidthPx / 16)}rem, 35vw)`;
                input.style.width = clampWidth;
                const wrapper = input.closest('.question-edit-wrapper'); if (wrapper) wrapper.style.width = clampWidth;
            };
            const persist = () => {
                try { localStorage.setItem('finalQuestions', JSON.stringify(finalQuestions)); } catch(err) { /* ignore */ }
            };
            input.addEventListener('input', (e)=>{
                const idx = parseInt(input.dataset.index); if (!Number.isNaN(idx)) finalQuestions[idx] = input.value.trim();
                adjustWidth();
                persist();
            });
            adjustWidth();
        });
        // 삭제 버튼
        const deleteBtns = container.querySelectorAll('.question-delete-btn');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', (e)=>{
                e.preventDefault();
                const idx = parseInt(btn.getAttribute('data-index'));
                if (Number.isNaN(idx)) return;
                finalQuestions.splice(idx, 1);
                try { localStorage.setItem('finalQuestions', JSON.stringify(finalQuestions)); } catch(err) { /* ignore */ }
                // 재렌더: 기본 병합 + 저장본 오버레이 적용
                renderFinalGuide();
            });
        });
    }

    // Suggestion widget wiring
    async function generateSuggestedQuestions(topN = 5) {
        const key = localStorage.getItem('openai_api_key') || '';
        const baseQs = collectOriginalQuestions();
        const conv = (window.interviewLog || []).slice(-40).map(r => ({
            q: r.question || '',
            u: r.userMessage || '',
            a: r.botAnswer || ''
        }));
        const prompt = (
`당신은 인터뷰 보조 AI입니다. 아래의 기존 질문들과 최근 모의 인터뷰 대화 로그를 참고하여, 기존 질문을 반복하지 않으면서 유용한 팔로업 또는 보완 질문 ${topN}개를 한국어로 제안하세요.
각 항목은 한 문장 질문형이어야 하며 번호 없이 배열로만 반환하세요.

기존 질문:
${baseQs.map((q,i)=>`${i+1}. ${q}`).join('\n')}

최근 대화 로그(최대 40턴, Q/U/A):
${conv.map(r=>`Q: ${r.q}\nU: ${r.u}\nA: ${r.a}`).join('\n\n')}
`);
        if (!key) {
            // 키가 없으면 간단한 휴리스틱 제안
            const heur = [
                '지금까지 답변을 종합하면 어떤 점이 가장 중요하다고 느끼시나요?',
                '그 경험에서 특히 기억에 남는 순간이 있었다면 말씀해 주실 수 있나요?',
                '일상에서 이를 실천하는 데 가장 큰 걸림돌은 무엇인가요?',
                '주변 사람들의 반응이나 영향은 어땠나요?',
                '앞으로 더 잘하기 위해 어떤 지원이 있으면 좋을까요?'
            ];
            return heur.slice(0, topN);
        }
        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: 'You return only JSON array of Korean questions. No extra text.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7
                })
            });
            const data = await res.json();
            const text = data?.choices?.[0]?.message?.content || '[]';
            let arr = [];
            try { arr = JSON.parse(text); } catch (_) {
                // 간단 파서: 줄바꿈 기반
                arr = text.split(/\n+/).map(s=>s.replace(/^[-*\d\.\s]+/, '').trim()).filter(Boolean);
            }
            return arr.slice(0, topN);
        } catch (e) {
            console.warn('suggestions failed', e);
            return [];
        }
    }
    async function renderSuggestionWidget() {
        const list = document.getElementById('suggestedQuestionsList');
        if (!list) return;
        const qs = await generateSuggestedQuestions(5);
        if (!qs.length) {
            list.innerHTML = '<li><div class="suggestion-pill">제안을 생성할 수 없습니다. 대화 로그를 더 쌓은 뒤 다시 시도해주세요.</div></li>';
            return;
        }
    list.innerHTML = qs.map(q=>`<li><div class="suggestion-pill">${q}</div></li>`).join('');
    }

    // Buttons
    (function wireFinalGuideButtons(){
        const printBtn = document.getElementById('printFinalGuideBtn');
        if (printBtn) printBtn.addEventListener('click', ()=> window.print());
        const regenBtn = document.getElementById('regenSuggestionsBtn');
        if (regenBtn) regenBtn.addEventListener('click', ()=> renderSuggestionWidget());
    })();

    // Nav wiring: when switching to Final Guide (revision), render
    (function wireNavForFinalGuide(){
        const navItems = Array.from(document.querySelectorAll('#nav-bar .btn-revision'));
        navItems.forEach(el=>{
            el.addEventListener('click', ()=>{
                setTimeout(()=>{ currentEditContext = 'final'; renderFinalGuide(); renderSuggestionWidget(); }, 50);
            });
        });
    })();

    // ===== 통합 레이어 추가: 상수/유틸/임베딩/페이즈/스타일/생성 =====
    const ACK_REGEX = /^(네|넵|예|응|어|음|아|맞[아요]|그렇[죠|습니다]?|좋[아요]|오케이|ok)\s*$/i;
    const KO_STOPWORDS = new Set(['그리고', '그러나', '하지만', '그러면', '그래서', '또', '또는', '즉', '혹은', '이것', '저것', '그것', '거기', '여기', '저기', '좀', '아주', '매우', '너무', '정말', '진짜', '거의', '약간', '등', '등등', '같은', '것', '수', '때', '점', '및', '는', '은', '이', '가', '을', '를', '에', '의', '로', '으로', '와', '과', '도', '만', '에게', '한', '하다', '했습니다', '했어요', '하는', '되다', '됐다']);
    const sum = arr => arr.reduce((a, b) => a + b, 0);
    const msToMinSec = (ms) => {
        const s = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(s / 60);
        return `${m}m ${String(s % 60).padStart(2, '0')}s`;
    };
    const byCountDesc = (a, b) => b.count - a.count;
    function simpleTokenizeKorean(text) { return (text || "").replace(/[^\p{Script=Hangul}\w\s]/gu, " ").toLowerCase().split(/\s+/).filter(t => t && t.length > 1 && !KO_STOPWORDS.has(t)); }
    function extractTopKeywords(logs, topN = 12) { if (!Array.isArray(logs) || !logs.length) return []; const txt = logs.map(r => `${r.userMessage || ''} ${r.botAnswer || ''}`).join(' '); const tokens = simpleTokenizeKorean(txt); const map = new Map(); for (const t of tokens) map.set(t, (map.get(t) || 0) + 1); return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([text, count]) => ({ text, weight: count })); }

    let _qEmbeddings = null;
    async function embedText(key, text) { const r = await fetch("https://api.openai.com/v1/embeddings", { method: "POST", headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }, body: JSON.stringify({ model: "text-embedding-3-small", input: text }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error?.message || 'Embeddings API error'); return d.data[0].embedding; }
    function cosineSim(a, b) { let dot = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[b]; } return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9); }
    async function ensureQuestionEmbeddings(key, qs) { if (!Array.isArray(qs) || !qs.length) { _qEmbeddings = null; return; } _qEmbeddings = await Promise.all(qs.map(q => embedText(key, q))); }
    async function classifyQuestionIndex(userText, lastIdx, qs, key) {
        if (!userText || userText.trim().length < 2 || ACK_REGEX.test(userText.trim())) return { index: Math.max(0, lastIdx), score: 0, reason: 'ack/short' };
        if (!_qEmbeddings) await ensureQuestionEmbeddings(key, qs);
        if (!_qEmbeddings) return { index: Math.max(0, lastIdx), score: 0, reason: 'no-emb' };
        const uEmb = await embedText(key, userText); const sims = _qEmbeddings.map((e, i) => ({ i, s: cosineSim(uEmb, e) })).sort((a, b) => b.s - a.s);
        const best = sims[0], second = sims[1] || { s: 0 }; let idx = best.i + 1; const margin = best.s - second.s;
        const bigJump = Math.abs(idx - Math.max(1, lastIdx)) >= 3;
        if (bigJump && margin < 0.06) idx = (best.i + 1 > lastIdx) ? lastIdx + 1 : Math.max(1, lastIdx);
        if (best.s < 0.24) idx = Math.max(1, lastIdx);
        if (/(다음|이제|넘어가|본론|그럼)/.test(userText) && lastIdx >= 0) idx = Math.min(qs?.length || idx, Math.max(1, lastIdx + 1));
        return { index: idx, score: best.s, reason: `best=${best.s.toFixed(3)}` };
        // qEmbeddings 값 console로 확인
    }


    const GREET_REGEX = /(안녕|안녕하세요|처음|반갑|만나서)/i; const SMALLTALK_REGEX = /(날씨|주말|요즘|점심|커피|출근|취미|취향|근황)/i;
    function detectPhase({ lastIndex, turnCount, userText }) { if (turnCount <= 2 || GREET_REGEX.test(userText)) return 0; if (lastIndex === 0 || SMALLTALK_REGEX.test(userText)) return 1; return 2; }

    function safeParseJSON(s) { try { return JSON.parse(s); } catch (e) { } const m = s && s.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch (e) { } } return null; }
    async function getStyleHintsLLM(key, { personaState, userMessage, phase, predictedIndex, questions }) {
        const base = { tone: 'neutral', allow_micro_openers: [], use_short_episode: false, sentence_target: '2-3', followup: { should_ask: false, template: '' } };
        const prompt = `당신은 인터뷰 톤 코치입니다. 아래 정보를 보고 스타일 힌트를 JSON으로만 반환하세요.\n[퍼소나] ${selectedPersona?.name || '-'} / ${selectedPersona?.age || '-'} / ${selectedPersona?.gender || '-'} / ${selectedPersona?.occupation || '-'}\n성격:${selectedPersona?.personality || '-'}\n[단계] ${phase}\n[현재 질문 후보] ${predictedIndex}\n[사용자 발화]\n"""${(userMessage || '').slice(0, 500)}"""`;
        try {
            const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }, body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: 'user', content: prompt }], temperature: 0.6, max_tokens: 300 }) });
            const d = await r.json(); const p = safeParseJSON(d?.choices?.[0]?.message?.content || ""); if (!p) return base;
            return { tone: p.tone || base.tone, allow_micro_openers: Array.isArray(p.allow_micro_openers) ? p.allow_micro_openers.slice(0, 3) : [], use_short_episode: !!p.use_short_episode, sentence_target: p.sentence_target || base.sentence_target, followup: { should_ask: !!(p.followup && p.followup.should_ask), template: (p.followup && p.followup.template) || '' } };
        } catch (e) { return base; }
    }
    function buildSystemPrompt(interviewTitle, questions, predictedIndex, phase, personaState, styleHints) {
        const qref = Array.isArray(questions) ? questions.join(', ') : ''; const openers = (styleHints?.allow_micro_openers || []).join(' / ');
        return `당신은 인터뷰 대상 퍼소나입니다. 자연스러운 구어체로 답변하세요.\n[역할] ${personaState.name} (${personaState.age}세, ${personaState.gender}, ${personaState.occupation})\n[성격] ${personaState.personality || '평범'}\n[언어습관] ${personaState.speech || '자연스러운 구어체'}\n[대화 단계] ${phase} (0=아이스브레이킹, 1=잡담, 2=본론)\n[현재 질문 번호 후보] ${predictedIndex}\n[인터뷰 주제] ${interviewTitle}\n[질문 목록(참고)] ${qref}\n[스타일 힌트] tone=${styleHints.tone}, 문장수=${styleHints.sentence_target}, micro-openers=${openers || '(없음)'}\n원칙: 이모지·표 금지, 메타발화 금지, 과도한 형식화 금지.`;
    }
    async function generateCoreAnswer(key, systemPrompt, userMessage, { phase }) {
        const payload = { model: modelId, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }], temperature: (phase <= 1 ? 0.7 : 0.9), max_tokens: (phase <= 1 ? 220 : 420), top_p: 1, frequency_penalty: 0.15, presence_penalty: 0.1 };
        const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }, body: JSON.stringify(payload) }); const d = await r.json(); if (!r.ok) throw new Error(d.error?.message || 'gen error'); return (d.choices?.[0]?.message?.content || '').trim();
    }
    function approxTokenCount(t) { return t ? Math.ceil(t.length / 3) : 0; }
    const FILLER_REGEX = /(\b|\s)(음+|어+|그+|그러니까|그런데|뭐랄까)(?=\b|\s)/g;
    function countFillers(t) { const m = t?.match(FILLER_REGEX); return m ? m.length : 0; }
    function extractTopicHint(t) { return null; }

    // 음성 인식 자동 루프
    const SR = (window.SpeechRecognition || window.webkitSpeechRecognition) ? new (window.SpeechRecognition || window.webkitSpeechRecognition)() : null;
    let isListening = false, isSpeaking = false, isPending = false;
    function setMicStatus(t) { const s = document.getElementById('micStatus'); const b = document.getElementById('micButton'); if (s) s.textContent = t; if (b) { if (t === '듣는 중') b.classList.add('active'); else b.classList.remove('active'); } }
    function safeStart() { try { SR && SR.start(); } catch (e) { } }
    if (SR) { SR.lang = 'ko-KR'; SR.interimResults = false; SR.continuous = false; SR.onstart = () => { try { audioElement.pause(); } catch (_) { } isListening = true; setMicStatus('듣는 중'); try { syncChatingLeftImage(selectedPersona, false); } catch (_) { } }; SR.onend = () => { isListening = false; setMicStatus('대기'); if (!isSpeaking && !isPending) setTimeout(safeStart, 250); }; SR.onerror = (e) => { isListening = false; setMicStatus('에러'); const nonFatal = ['no-speech', 'audio-capture', 'not-allowed', 'aborted']; if (!isSpeaking && !isPending && !nonFatal.includes(e.error)) setTimeout(safeStart, 600); }; SR.onresult = (ev) => { let txt = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) { const r = ev.results[i]; if (r.isFinal) txt += r[0].transcript; } if (txt) sendMessage(txt, true); }; setTimeout(safeStart, 500); }
    const micBtnEl = document.getElementById('micButton'); if (micBtnEl) { micBtnEl.addEventListener('click', () => { if (!isListening) safeStart(); }); }

    async function sendMessage(voiceInput, isVoice) {
        const key = apiKey; // 전역 apiKey만 신뢰
        const inputEl = document.getElementById('userInput'); const userText = (typeof voiceInput === 'string') ? voiceInput : (inputEl?.value || '').trim();
        if (!key) { alert('API 키가 필요합니다.'); return; }
        if (!userText) { alert('메시지를 입력해주세요.'); return; }
        if (!selectedPersona) { alert('퍼소나를 먼저 선택해주세요.'); return; }

        // Analytics hooks: mark user turn start and run counters (async, non-blocking)
        let userTurn = null;
        try {
            if (window.AnalyticsKit && window.AnalyticsKit.Timeline && typeof window.AnalyticsKit.Timeline.markStart === 'function') {
                userTurn = window.AnalyticsKit.Timeline.markStart('user');
            }
            if (window.AnalyticsKit && window.AnalyticsKit.Counters && typeof window.AnalyticsKit.Counters.onUserUtter === 'function') {
                // fire-and-forget to avoid blocking UI; it will update counters/timeline internally
                window.AnalyticsKit.Counters.onUserUtter(userText).catch(e => console.warn('Counters.onUserUtter failed', e));
            }
        } catch (e) { console.warn('AnalyticsKit pre-send hooks error', e); }

        // 보강: 임베딩 보장 (최후 방어)
        if (!_qEmbeddings && Array.isArray(questions) && questions.length) {
            try { await ensureQuestionEmbeddings(key, questions); }
            catch (e) { console.error('embeddings init fail in send:', e); }
        }

        // 질문 인덱스 추정
        let predicted = { index: Math.max(1, lastIndex || 1), score: 0, reason: 'default' };
        const prevIndex = lastIndex || 0; // 직전 인덱스 보관
        try { predicted = await classifyQuestionIndex(userText, lastIndex || 0, questions || [], key); } catch (e) { }
        // 팔로업 카운팅: 같은 질문에서 사용자가 '질문'을 이어가면 팔로업으로 간주
        try {
            const S = window.AnalyticsKit && window.AnalyticsKit.Store;
            const isQ = !!(window.AnalyticsKit && window.AnalyticsKit.NLP && window.AnalyticsKit.NLP.isQuestion && window.AnalyticsKit.NLP.isQuestion(userText));
            if (S && isQ && predicted.index === Math.max(1, prevIndex)) {
                const idx = predicted.index;
                S.followupsByQuestion[idx] = (S.followupsByQuestion[idx] || 0) + 1;
                // UI 배지 즉시 갱신
                updateFollowupBadges();
            }
        } catch (_) {}

        highlightCurrentQuestion(predicted.index);
        if (lastIndex === 0 && predicted.index === 1 && !document.querySelector('.stage-message')) { appendStageMessage('인터뷰를 시작합니다'); }
        lastIndex = predicted.index;

        // 진행 중 질문 인덱스 Store 반영
        try { if (window.AnalyticsKit?.Store) window.AnalyticsKit.Store.currentQuestionIndex = lastIndex; } catch (_) {}

    // 사용자 메시지 반영
    showUserMessage(userText);
    if (!isVoice && inputEl) inputEl.value = '';

        // 페이즈 결정
        const interviewTitle = interviewTitleInput.value.trim();
        const turnCount = (interviewLog || []).length + 1;
        const phase = detectPhase({ lastIndex, turnCount, userText });

        // 스타일 힌트→시스템 프롬프트→코어 응답
        const t0 = Date.now(); isPending = true; setMicStatus('GPT 응답 대기');
        try {
            const styleHints = await getStyleHintsLLM(key, { personaState: { name: selectedPersona?.name, age: selectedPersona?.age, gender: selectedPersona?.gender, occupation: selectedPersona?.occupation, personality: selectedPersona?.personality, speech: selectedPersona?.speech }, userMessage: userText, phase, predictedIndex: lastIndex, questions });
            const systemPrompt = buildSystemPrompt(interviewTitle, questions, lastIndex, phase, { name: selectedPersona?.name, age: selectedPersona?.age, gender: selectedPersona?.gender, occupation: selectedPersona?.occupation, personality: selectedPersona?.personality, speech: selectedPersona?.speech }, styleHints);
            const answer = await generateCoreAnswer(key, systemPrompt, userText, { phase });

            showBotMessage(answer);
            // OpenAI TTS로 바로 읽어주기
            try { await speakTextPersona(answer, selectedPersona); } catch (_) { }

            const t1 = Date.now();
            interviewLog.push({
                questionIndex: lastIndex,
                question: (questions && questions[lastIndex - 1]) ? questions[lastIndex - 1] : '(파생 질문)',
                userMessage: userText,
                botAnswer: answer,
                timestampStart: t0,
                timestampEnd: t1,
                userChars: userText.length,
                botChars: answer.length,
                userTokens: approxTokenCount(userText),
                botTokens: approxTokenCount(answer),
                userFillerCount: countFillers(userText),
                userEmotion: null,
                botAcknowledged: null
            });
            // Analytics: mark user turn end
            try {
                if (userTurn && window.AnalyticsKit && window.AnalyticsKit.Timeline && typeof window.AnalyticsKit.Timeline.markEnd === 'function') {
                    window.AnalyticsKit.Timeline.markEnd(userTurn, userText);
                }
            } catch (e) { console.warn('AnalyticsKit markEnd error', e); }
            // WS/Python server: disabled, but legacy send is no-op
            __legacySocketSendSilently__({ gptResponse: answer });
            isPending = false; setMicStatus('듣는 중');
            // 응답 후 자동 재시작
            if (typeof SR !== 'undefined' && SR && !isListening && !isSpeaking) {
                try { safeStart(); } catch (_) { }
            }
        } catch (e) {
            appendMessage(`Error: ${e.message}`, 'bot');
            // ensure analytics marks turn end on error as well
            try {
                if (userTurn && window.AnalyticsKit && window.AnalyticsKit.Timeline && typeof window.AnalyticsKit.Timeline.markEnd === 'function') {
                    window.AnalyticsKit.Timeline.markEnd(userTurn, userText);
                }
            } catch (err) { console.warn('AnalyticsKit markEnd on error failed', err); }
            isPending = false; setMicStatus('대기');
            // 에러 시에도 자동 재시작 시도
            if (typeof SR !== 'undefined' && SR && !isListening && !isSpeaking) {
                try { safeStart(); } catch (_) { }
            }
        }
    }


    // ================== AnalyticsKit 통합 모듈 ==================

    // 0) 공통 네임스페이스
    window.AnalyticsKit = window.AnalyticsKit || {};

    // 1) 상태/스토어 모듈 (store)
    (function (NS) {
        const Store = {
            sessionStart: performance.now(),
            turns: [],
            timeline: [],
            questionsPrepared: [],
            qEmbeddings: null,
            isPersonaSpeaking: false,
            counters: {
                backchannelsByUser: 0,
                adHocQuestions: 0,
                followupChains: 0,
                interruptions: 0,
                disfluencies: 0
            },
            followupDepth: 0,
            lastUserQuestionText: "",
            // === added: 팔로업/현재 질문 상태 ===
            followupsByQuestion: {},    // { [questionIndex:number]: count }
            currentQuestionIndex: 0,    // 진행중인 질문 인덱스(1-base, 0=아이스브레이킹)
            apiKey() { return localStorage.getItem("openai_api_key") || ""; }
        };
        NS.Store = Store;
    })(window.AnalyticsKit);

    // 2) 타임라인/훅 모듈 (timeline)
    (function (NS) {
        const S = NS.Store;
        function markStart(speaker) {
            return { t: Date.now(), speaker, msStart: performance.now(), text: "" };
        }
        function markEnd(turn, text) {
            turn.msEnd = performance.now();
            turn.text = (text || "").trim();
            S.turns.push(turn);
            S.timeline.push({
                start: turn.msStart - S.sessionStart,
                end: turn.msEnd - S.sessionStart,
                speaker: turn.speaker
            });
        }
        let personaTurn = null;
        function personaSpeakStart() {
            if (personaTurn) return personaTurn;
            personaTurn = markStart('persona');
            S.isPersonaSpeaking = true;
            return personaTurn;
        }
        function personaSpeakEnd(text = '') {
            if (personaTurn) {
                markEnd(personaTurn, text);
                personaTurn = null;
            }
            S.isPersonaSpeaking = false;
        }
        NS.Timeline = { markStart, markEnd, personaSpeakStart, personaSpeakEnd };
    })(window.AnalyticsKit);

    // 3) 임베딩/질문·유사도/NLP 유틸 (nlp)
    (function (NS) {
        const S = NS.Store;
        function cosineSim(a, b) {
            let dot = 0, na = 0, nb = 0;
            for (let i = 0; i < Math.min(a.length, b.length); i++) {
                dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[b];
            }
            return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
        }
        async function embedText(text) {
            const apiKey = S.apiKey();
            const res = await fetch("https://api.openai.com/v1/embeddings", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
                body: JSON.stringify({ model: "text-embedding-3-small", input: text })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || "Embeddings API error");
            return data.data[0].embedding;
        }
        async function ensurePreparedEmbeddings(questions) {
            if (window.ensureQuestionEmbeddings) {
                S.qEmbeddings = await window.ensureQuestionEmbeddings(S.apiKey(), questions);
                S.questionsPrepared = questions.slice();
                return S.qEmbeddings;
            }
            S.questionsPrepared = questions.slice();
            S.qEmbeddings = [];
            for (const q of questions) S.qEmbeddings.push(await embedText(q));
            return S.qEmbeddings;
        }
        async function maxSimToPrepared(questionText) {
            if (!S.qEmbeddings || !S.qEmbeddings.length) return 0;
            const qv = await embedText(questionText);
            let maxSim = -1;
            for (const pv of S.qEmbeddings) maxSim = Math.max(maxSim, cosineSim(qv, pv));
            return maxSim;
        }
        const reBackchannel = /(네|넵|예|맞[아요]*|음+|으응|아[ ]?네|좋아요|오케이|okay|yeah|uh-?huh|got it|right)/i;
        function isBackchannel(s) {
            const t = (s || "").trim();
            if (!t) return false;
            if (t.length > 20) return false;
            if (/\?/.test(t)) return false;
            return reBackchannel.test(t) || t.length <= 6;
        }
        function isQuestion(s) {
            const t = (s || "").trim();
            return /\?$/.test(t) || /(왜|어떻게|무엇|어느|가능할까요|가능해|가능합니까|설명|자세히|구체적으로)/.test(t);
        }
        const reDisfl = /(음+|어+|에에|그[\,\.\s]|저기[\,\.\s])/gi;
        function countDisfluencies(s) {
            const m = (s || "").match(reDisfl);
            return m ? m.length : 0;
        }
        NS.NLP = {
            cosineSim, embedText, ensurePreparedEmbeddings, maxSimToPrepared,
            isBackchannel, isQuestion, countDisfluencies
        };
    })(window.AnalyticsKit);

    // 4) 카운터/판정 모듈 (counters)
    (function (NS) {
        const S = NS.Store;
        const { isBackchannel, isQuestion, maxSimToPrepared, cosineSim, countDisfluencies } = NS.NLP;
        async function onUserUtter(text) {
            if (isBackchannel(text)) S.counters.backchannelsByUser++;
            S.counters.disfluencies += countDisfluencies(text);
            if (S.isPersonaSpeaking) S.counters.interruptions++;
            if (isQuestion(text)) {
                let isFollowup = false;
                if (S.lastUserQuestionText) {
                    const v1 = await NS.NLP.embedText(text);
                    const v2 = await NS.NLP.embedText(S.lastUserQuestionText);
                    if (cosineSim(v1, v2) > 0.85) isFollowup = true;
                }
                if (isFollowup) {
                    S.followupDepth++;
                    if (S.followupDepth >= 3) { S.counters.followupChains++; S.followupDepth = 0; }
                } else {
                    S.followupDepth = 0;
                    const simPrep = await maxSimToPrepared(text);
                    if (simPrep < 0.82) S.counters.adHocQuestions++;
                }
                S.lastUserQuestionText = text;
            }
        }
        NS.Counters = { onUserUtter };
    })(window.AnalyticsKit);

    // 5) KPI/타임라인 렌더 모듈 (render)
    (function (NS) {
        const S = NS.Store;
        function computeTalkSplit() {
            const segments = Array.isArray(S.timeline) ? S.timeline : [];
            let personaValue = 0;
            let userValue = 0;
            segments.forEach(seg => {
                const duration = Math.max(0, (seg?.end ?? 0) - (seg?.start ?? 0));
                if (seg.speaker === 'persona') personaValue += duration;
                else if (seg.speaker === 'user') userValue += duration;
            });
            if (personaValue + userValue === 0) {
                const logs = Array.isArray(window.interviewLog) ? window.interviewLog : [];
                if (logs.length) {
                    personaValue = logs.reduce((sum, row) => sum + (row.botAnswer || '').length, 0);
                    userValue = logs.reduce((sum, row) => sum + (row.userMessage || '').length, 0);
                }
            }
            const total = personaValue + userValue;
            const personaPct = total ? Math.round((personaValue / total) * 100) : 0;
            const userPct = total ? Math.max(0, 100 - personaPct) : 0;
            return { personaPct, userPct, personaValue, userValue, total };
        }
        function computeTailCount() {
            const followups = S.followupsByQuestion || {};
            return Object.values(followups).reduce((acc, num) => acc + Number(num || 0), 0);
        }
        function computeKPIs() {
            return {
                talkSplit: computeTalkSplit(),
                tailCount: computeTailCount()
            };
        }
        function renderKPIs() {
            const { talkSplit, tailCount } = computeKPIs();
            const elTalkSplit = document.querySelector('#kpiTalkSplit');
            const elTail = document.querySelector('#kpiTailCount');
            if (elTalkSplit) {
                elTalkSplit.textContent = `[응답자 ${talkSplit.personaPct}% | 진행자 ${talkSplit.userPct}%]`;
            }
            if (elTail) {
                elTail.textContent = `${tailCount}회`;
            }
        }
        function renderTimeline() {
            const wrap = document.getElementById('utteranceTimeline');
            if (!wrap) return;
            wrap.innerHTML = '';
            const segments = Array.isArray(S.timeline) ? S.timeline : [];
            const totalDuration = segments.reduce((sum, seg) => sum + Math.max(0, (seg?.end ?? 0) - (seg?.start ?? 0)), 0);
            const { personaPct, userPct } = computeTalkSplit();

            const legend = document.createElement('div');
            legend.className = 'utt-legend';
            legend.innerHTML = `
                <span class="legend-item"><span class="legend-dot legend-dot--persona"></span>응답자</span>
                <span class="legend-item"><span class="legend-dot legend-dot--user"></span>진행자</span>
                <span class="utt-split">[응답자 ${personaPct}% | 진행자 ${userPct}%]</span>
            `;
            wrap.appendChild(legend);

            const track = document.createElement('div');
            track.className = 'utt-track';
            wrap.appendChild(track);

            if (!totalDuration) {
                const logs = Array.isArray(window.interviewLog) ? window.interviewLog : [];
                const totalChars = logs.reduce((sum, row) => sum + (row.userMessage || '').length + (row.botAnswer || '').length, 0);
                if (!totalChars) {
                    const empty = document.createElement('div');
                    empty.className = 'utt-empty';
                    empty.textContent = '대화 기록이 없습니다.';
                    track.appendChild(empty);
                    return;
                }
                logs.forEach(row => {
                    const userLen = (row.userMessage || '').length;
                    const personaLen = (row.botAnswer || '').length;
                    if (userLen > 0) {
                        const bar = document.createElement('div');
                        bar.className = 'utt-bar bar--user';
                        bar.style.width = `${Math.max(0.5, (userLen / totalChars) * 100)}%`;
                        track.appendChild(bar);
                    }
                    if (personaLen > 0) {
                        const bar = document.createElement('div');
                        bar.className = 'utt-bar bar--persona';
                        bar.style.width = `${Math.max(0.5, (personaLen / totalChars) * 100)}%`;
                        track.appendChild(bar);
                    }
                });
                return;
            }

            segments.forEach(seg => {
                const duration = Math.max(0, (seg?.end ?? 0) - (seg?.start ?? 0));
                const widthPct = Math.max(0.5, (duration / totalDuration) * 100);
                const bar = document.createElement('div');
                bar.className = `utt-bar ${seg.speaker === 'user' ? 'bar--user' : 'bar--persona'}`;
                bar.style.width = `${widthPct}%`;
                track.appendChild(bar);
            });
        }
        NS.Render = { renderKPIs, renderTimeline, computeKPIs, computeTalkSplit };
    })(window.AnalyticsKit);

    // 6) 정서적 대응 3건 생성 모듈 (emotions)
    (function (NS) {
        // 새 정서적 응대 로컬 분석기로 교체
        const S = NS.Store;

        // 간단 휴리스틱 패턴들 (인터뷰어=사용자 발화 기준)
        const RE = {
            empathy: /(그럴 수 있겠(네|어요)|그렇군요|그랬군요|힘드셨겠(죠|어요|네요)|어려우셨겠(죠|어요|네요)|고생하셨(겠|네)요|이해됩니다|이해돼요|공감합니다|말씀해주셔서 감사합니다|감사합니다)/i,
            support: /(잘해주고 계세요|조금 더|좀 더|이어(서)? (말씀|설명)해주셔도 돼요|계속 말씀하셔도 돼요|더 말씀해주셔도 돼요|편하게 말씀|천천히 말씀|괜찮아요|부담 갖지 마세요)/i,
            // 비판·판단 회피: "~군요/~겠네요"로 수용 + 개방형 후속 요청
            nonjudgment_combo: /((군요|겠네요|겠어요|그렇군요).*(더|좀|조금|자세히).*(말씀|들려|설명).*\?$)/i,
            // 라포 형성(아이스브레이킹/완화)
            rapport: /(편하게|자유롭게|괜찮습니다|정답은 없|부담 갖지|가볍게 시작|천천히 해도|반갑습니다|환영합니다)/i,
            // 부정적/판단적 어휘(감점/제외 목적)
            judging_neg: /(왜 그렇게 했|그건 잘못|틀렸|말이 안 되|상식적이지 않|비합리|비난|책임은 당신|네 탓|너 때문)/i
        };

        function splitSentences(t) {
            return (t || '')
                .split(/(?<=[\.!\?…]|[^\p{Script=Hangul}]$)|(?<=요)\s|(?<=다)\s/gu)
                .map(s => s.trim())
                .filter(Boolean);
        }

        function analyzeEmotionalResponses() {
            // 우선순위 데이터 소스: AnalyticsKit.Store.turns → window.interviewLog
            let userUtterances = [];
            if (Array.isArray(S?.turns) && S.turns.length) {
                userUtterances = S.turns.filter(t => t.speaker === 'user').map(t => t.text || '').filter(Boolean);
            } else if (Array.isArray(window.interviewLog) && window.interviewLog.length) {
                userUtterances = window.interviewLog.map(r => r.userMessage || '').filter(Boolean);
            }

            const total = userUtterances.length || 0;
            const buckets = {
                empathy: { count: 0, samples: [] },
                support: { count: 0, samples: [] },
                nonjudgment: { count: 0, samples: [] },
                rapport: { count: 0, samples: [] }
            };

            // 문장 단위로 정밀 탐지
            userUtterances.forEach(utt => {
                const sentences = splitSentences(utt);
                sentences.forEach(s => {
                    // 판단적 어휘 포함 시 정서적 응대 카운트에서 제외
                    if (RE.judging_neg.test(s)) return;

                    if (RE.empathy.test(s)) {
                        buckets.empathy.count++;
                        if (buckets.empathy.samples.length < 2) buckets.empathy.samples.push(s);
                        return;
                    }
                    if (RE.support.test(s)) {
                        buckets.support.count++;
                        if (buckets.support.samples.length < 2) buckets.support.samples.push(s);
                        return;
                    }
                    if (RE.nonjudgment_combo.test(s)) {
                        buckets.nonjudgment.count++;
                        if (buckets.nonjudgment.samples.length < 2) buckets.nonjudgment.samples.push(s);
                        return;
                    }
                    if (RE.rapport.test(s)) {
                        buckets.rapport.count++;
                        if (buckets.rapport.samples.length < 2) buckets.rapport.samples.push(s);
                        return;
                    }
                });
            });

            const supportiveSum = buckets.empathy.count + buckets.support.count + buckets.nonjudgment.count + buckets.rapport.count;
            const score = Math.round((supportiveSum / Math.max(1, total)) * 100);

            return {
                totalUserUtterances: total,
                buckets,
                score // 정서적 응대 점수 (0~100)
            };
        }

        function renderEmotionalCards(targetId = "#feedbackList") {
            const box = document.querySelector(targetId) || document.querySelector('#emotionList');
            if (!box) return;

            const result = analyzeEmotionalResponses();

            // 데이터 없음 처리
            if (!result.totalUserUtterances) {
                box.innerHTML = `
                    <li class="emotion-card">
                        <div class="emotion-title">정서적 응대 분석</div>
                        <div class="emotion-note">인터뷰어 발화가 없어 분석할 수 없습니다.</div>
                    </li>
                `;
                box.dataset.emotionSource = 'local-heuristic';
                return;
            }

            const { buckets, totalUserUtterances } = result;
            const supportiveTotal = buckets.empathy.count + buckets.support.count + buckets.nonjudgment.count + buckets.rapport.count;

            const detailItems = [
                {
                    key: 'empathy',
                    title: '공감·인정 표현',
                    count: buckets.empathy.count,
                    samples: buckets.empathy.samples
                },
                {
                    key: 'support',
                    title: '지지·격려 표현',
                    count: buckets.support.count,
                    samples: buckets.support.samples
                },
                {
                    key: 'nonjudgment',
                    title: '비판·판단 회피',
                    count: buckets.nonjudgment.count,
                    samples: buckets.nonjudgment.samples
                },
                {
                    key: 'rapport',
                    title: '라포 형성 발화',
                    count: buckets.rapport.count,
                    samples: buckets.rapport.samples
                }
            ].filter(it => it.count > 0);

            const summaryCard = supportiveTotal
                ? `
                    <li class="emotion-card">
                        <div class="emotion-title">정서적 응대 발화 <span style="color:#8F949B">(${supportiveTotal}회)</span></div>
                        <div class="emotion-note" style="color:#666">인터뷰어 발화 ${totalUserUtterances}건 중 정서적 응대 문장 ${supportiveTotal}건을 찾았어요.</div>
                    </li>
                `
                : `
                    <li class="emotion-card">
                        <div class="emotion-title">정서적 응대 발화</div>
                        <div class="emotion-note" style="color:#666">아직 정서적 응대 표현을 찾지 못했어요. 공감이나 지지 문장을 추가로 시도해 보세요.</div>
                    </li>
                `;

            const detailHtml = detailItems.length
                ? detailItems.map(it => {
                    const sampleHtml = (it.samples && it.samples.length)
                        ? `<div class="emotion-note" style="color:#666">예: “${it.samples[0]}”${it.samples[1] ? ` / “${it.samples[1]}”` : ''}</div>`
                        : '';
                    return `
                        <li class="emotion-card">
                            <div class="emotion-title">${it.title} <span style="color:#8F949B">(${it.count})</span></div>
                            ${sampleHtml}
                        </li>
                    `;
                }).join("")
                : `
                    <li class="emotion-card">
                        <div class="emotion-note" style="color:#666">되짚어볼 만한 정서적 응대 문장이 아직 없습니다.</div>
                    </li>
                `;

            box.dataset.emotionSource = 'local-heuristic';
            box.innerHTML = summaryCard + detailHtml;
        }

        // 노출 API
        NS.Emotions = { renderEmotionalCards };
    })(window.AnalyticsKit);

    // 7) 초기화/와이어링 모듈 (init)
    (function (NS) {
        function init() {
            if (window.questions && window.questions.length) {
                NS.NLP.ensurePreparedEmbeddings(window.questions).catch(console.warn);
            }
            const analysisBtn = document.querySelector(".btn-analysis");
            if (analysisBtn) {
                analysisBtn.addEventListener("click", () => {
                    NS.Render.renderKPIs();
                    NS.Render.renderTimeline();
                    NS.Emotions.renderEmotionalCards("#feedbackList");
                });
            }
        }
        NS.init = init;
    })(window.AnalyticsKit);

    // 페이지 로드 후 한 번 호출
    window.AnalyticsKit.init();

    // wire send button and Enter key for user input
    const sendBtn = document.getElementById('sendButton');
    const userInputEl = document.getElementById('userInput');
    if (sendBtn) sendBtn.addEventListener('click', (e) => { e.preventDefault(); sendMessage(null, false); });
    if (userInputEl) userInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(null, false); } });

        // #logo img 클릭 시 메인화면(첫 번째 탭)으로 이동
        const logoImg = document.querySelector('#logo img');
        if (logoImg) {
            logoImg.style.cursor = 'pointer';
            logoImg.addEventListener('click', function() {
                location.reload();
            });
        }
    // ===== 질문 추가 플러스(+) 버튼 복원 =====
    const globalAddBtn = document.getElementById("global-question-add-btn");
    let currentHoverIndex = null;

    document.addEventListener("mouseover", (e) => {
        const wrapper = e.target.closest(".question-edit-wrapper");
        if (!wrapper) return;
        // 현재 편집 컨텍스트 설정: finalQuestionsList 내부인지 여부
        currentEditContext = wrapper.closest('#finalQuestionsList') ? 'final' : 'base';

        const wrappers = [...document.querySelectorAll(".question-edit-wrapper")];
        const currentIndex = wrappers.indexOf(wrapper);

        // 이전 hover 제거
        wrappers.forEach(w => w.classList.remove("hover-next"));

        const nextWrapper = wrappers[currentIndex + 1];
        if (nextWrapper) {
            nextWrapper.classList.add("hover-next");
        }

        // 플러스 버튼 이동
        wrapper.appendChild(globalAddBtn);
        globalAddBtn.style.opacity = 1;
        globalAddBtn.style.pointerEvents = "auto";
        currentHoverIndex = currentIndex;
    });

    document.addEventListener("mouseout", (e) => {
        if (!e.relatedTarget?.closest(".question-edit-wrapper")) {
            globalAddBtn.style.opacity = 0;
            globalAddBtn.style.pointerEvents = "none";

            // 다음에 있던 클래스 제거
            document.querySelectorAll(".question-edit-wrapper").forEach(w => {
                w.classList.remove("hover-next");
            });
        }
    });

    if (globalAddBtn) {
        globalAddBtn.addEventListener("click", () => {
            // 현재 마우스가 올라간 row 인덱스 새로 계산 (혹시 currentHoverIndex가 null이거나 잘못된 경우)
            let wrappers = Array.from(document.querySelectorAll('.question-edit-wrapper'));
            let hoverIdx = wrappers.findIndex(w => w.contains(globalAddBtn));
            if (hoverIdx === -1) hoverIdx = currentHoverIndex;
            if (hoverIdx == null || hoverIdx < -1) hoverIdx = wrappers.length - 1;

            if (currentEditContext === 'final') {
                // 현재 입력값 저장 (final)
                const container = document.getElementById('finalQuestionsList');
                const inputs = container ? container.querySelectorAll('.question-edit-input') : [];
                inputs.forEach(input => {
                    const idx = parseInt(input.dataset.index);
                    if (!isNaN(idx) && idx < finalQuestions.length) {
                        finalQuestions[idx] = input.value;
                    }
                });
                finalQuestions.splice(hoverIdx + 1, 0, "");
                try { localStorage.setItem('finalQuestions', JSON.stringify(finalQuestions)); } catch(err) { /* ignore */ }
                renderFinalGuide();
                setTimeout(() => {
                    const wraps = document.querySelectorAll('#finalQuestionsList .question-edit-wrapper');
                    const newWrapper = wraps[hoverIdx + 1];
                    if (newWrapper) {
                        const input = newWrapper.querySelector('input.question-edit-input');
                        if (input) { input.focus(); input.select(); }
                    }
                }, 0);
                return;
            }

            // 기본 질문 컨텍스트
            if (typeof questions === 'undefined' || !Array.isArray(questions)) return;
            const inputs = document.querySelectorAll('#question-container .question-edit-input');
            inputs.forEach(input => {
                const idx = parseInt(input.dataset.index);
                if (!isNaN(idx) && idx < questions.length) {
                    questions[idx] = input.value;
                }
            });
            questions.splice(hoverIdx + 1, 0, "");
            questionNum = questions.length;
            const questionNumSpan = document.getElementById('count');
            if (questionNumSpan) questionNumSpan.textContent = questionNum;
            if (typeof window.renderQuestions === 'function') window.renderQuestions();
            setTimeout(() => {
                const wraps = document.querySelectorAll('#question-container .question-edit-wrapper');
                const newWrapper = wraps[hoverIdx + 1];
                if (newWrapper) {
                    const input = newWrapper.querySelector('input.question-edit-input');
                    if (input) { input.focus(); input.select(); }
                }
            }, 0);
        });
    }
});
// 팔로업 배지 렌더러
function updateFollowupBadges() {
    const S = window.AnalyticsKit && window.AnalyticsKit.Store;
    if (!S) return;
    const counts = S.followupsByQuestion || {};
    const lis = document.querySelectorAll('#questionList li');
    lis.forEach((li, i) => {
        const idx = i + 1; // Q index(1-base)
        let badge = li.querySelector('.followup-badge');
        const n = counts[idx] || 0;
        if (n > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'followup-badge';
                badge.style.marginLeft = '8px';
                badge.style.color = '#8F949B';
                badge.style.fontSize = '12px';
                li.appendChild(badge);
            }
            badge.textContent = `(팔로업 ${n})`;
        } else if (badge) {
            badge.remove();
        }
    });
}

// 퍼소나 다음버튼
document.getElementById("goToPersonaBtn").addEventListener("click", () => {
    // 모든 질문 input이 비어있는지 체크
    const questionInputs = document.querySelectorAll('.question-edit-input');
    let hasEmpty = false;
    questionInputs.forEach(input => {
        if (!input.value.trim()) {
            hasEmpty = true;
        }
    });
    if (hasEmpty) {
        alert('질문지 내용을 입력해주세요.');
        return;
    }
    // 유효성 검사 통과 시 페이지 전환
    document.getElementById("question-page").style.display = "none";
    document.getElementById("persona-page").style.display = "block";
    document.querySelector(".btn-persona").click();  // 탭 전환 효과 동일하게
});

// 전역 노출(필요 시 재호출)
window.updateFollowupBadges = updateFollowupBadges;
