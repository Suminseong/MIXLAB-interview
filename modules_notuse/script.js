document.addEventListener('DOMContentLoaded', function() {
    // 퍼소나 데이터 정의
    const personaList = [
        {
            name: "박지훈",
            age: 34,
            occupation: "하나은행 IT부 차장",
            personality: "사교적이고 분석적임",
            interests: "음식 탐방, 온라인 서비스 최적화",
            speech: "여유로움, 외향적, 내향적, 방어적, 장문형, 즉흥적",
            gender: "여성"
        }
        // 필요시 추가 퍼소나
    ];

    // 퍼소나 선택 함수
    window.selectPersona = function(idx) {
        window.selectedPersona = personaList[idx];
    };
    // 기본 퍼소나를 항상 선택하도록 하드코딩
    window.selectedPersona = personaList[0];
    const apiKey = ''; // GPT API 키
    document.getElementById('apiKeyInput').value = apiKey; // API 키 입력 필드에 설정
    let dataInterviewChatText = '';
    let dataInterviewChatIndex = 0;
    let dataInterviewArr = [
        {
            "id": dataInterviewChatIndex,
            "text": dataInterviewChatText,
            "isUser": true,
            "timestamp": new Date().toISOString()
        }
    ];
    // const chatContainer = document.getElementById('chat-container');
    const chatContainer = document.getElementById('chatbox'); // modules_notuse/index.html의 DOM과 일치하도록 수정

    // 대화 컨텍스트 및 상태 플래그
    const MODEL = "ft:gpt-4o-2024-08-06:chamkkae:chamkkae-v3a:AmwkrRHc";
    let messages = [];
    let isListening = false;
    let isSpeaking = false;
    let isPending = false; // GPT 응답 대기중

    // 메시지 UI 헬퍼
    function appendMessage(text, role) {
        if (!chatContainer) return;
        const el = document.createElement('div');
        el.className = `chat-message ${role}`;
        el.textContent = text;
        chatContainer.appendChild(el);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // OpenAI TTS API 기반 음성 합성
    async function speakText(text) {
        const key = (document.getElementById('apiKeyInput')?.value || '').trim();
        if (!key) return;
        isSpeaking = true;
        // 성별에 따라 TTS 보이스 선택 (gpt-4o-mini-tts 지원 보이스 예시: coral, breeze, etc)
        let voice = 'coral'; // 기본값
        const persona = window.selectedPersona;
        if (persona && persona.gender) {
            const gender = String(persona.gender).trim();
            if (gender === '여자' || gender === '여성' || gender === 'female' || gender === 'woman') {
                voice = 'alloy'; // 여성 보이스 예시
            } else if (gender === '남자' || gender === '남성' || gender === 'male' || gender === 'man') {
                voice = 'echo'; // 남성 보이스 예시
            }
        }
        // 감정, 억양 등 instructions 예시
        let instructions = '자연스럽고 친근한 톤으로 말하세요.';
        if (persona && persona.speech) {
            instructions += ` ${persona.speech}`;
        }
        try {
            // OpenAI TTS API 호출 (gpt-4o-mini-tts)
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
            if (!res.ok) {
                throw new Error('TTS API 오류: ' + res.status);
            }
            const audioBlob = await res.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.onended = () => {
                isSpeaking = false;
                if (!isListening && !isPending) safeStartRecognition();
                URL.revokeObjectURL(audioUrl);
            };
            audio.onerror = () => {
                isSpeaking = false;
                if (!isListening && !isPending) safeStartRecognition();
                URL.revokeObjectURL(audioUrl);
            };
            audio.play();
        } catch (e) {
            isSpeaking = false;
            if (!isListening && !isPending) safeStartRecognition();
        }
    }

    // 음성 데이터 입력용 Chrome web speech API
    const speechRecognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    speechRecognition.lang = 'ko-KR';
    speechRecognition.interimResults = true;
    speechRecognition.continuous = false; // 한 문장 단위로 종료되게 하고, 종료 시 재시작 로직으로 순환

    function safeStartRecognition() {
        try {
            speechRecognition.start();
        } catch (e) {
            // Already started 등 오류 무시
        }
    }

    speechRecognition.onstart = function() {
        isListening = true;
        // console.log('Listening...');
    };

    // dataInterviewChatIndex는 0부터 시작, 매 대화마다 1 증가
    speechRecognition.onresult = function(event) {
        // 최종 결과만 사용하여 GPT 호출
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) {
                finalTranscript += res[0].transcript;
            }
        }
        if (!finalTranscript) {
            // 중간결과만 들어온 경우 UI에 반영하지 않음
            return;
        }
        dataInterviewChatText = finalTranscript;
        dataInterviewChatIndex++;
        dataInterviewArr.push({
            id: dataInterviewChatIndex,
            text: dataInterviewChatText,
            isUser: true,
            timestamp: new Date().toISOString()
        });
        appendMessage(finalTranscript, 'user');
        // 최종 인식이 끝나면 GPT 호출
        callGPT(finalTranscript);
    };

    speechRecognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        isListening = false;
        // 에러 유형에 따라 재시작 시도
        const nonFatal = ['no-speech', 'audio-capture', 'not-allowed', 'aborted'];
        if (!isSpeaking && !isPending && !nonFatal.includes(event.error)) {
            setTimeout(safeStartRecognition, 600);
        }
    };

    speechRecognition.onend = function() {
        isListening = false;
        // 말하는 중이 아니고, GPT 대기중도 아니면 다시 듣기 시작
        if (!isSpeaking && !isPending) {
            setTimeout(safeStartRecognition, 250);
        }
    };

    // gpt 시스템 메시지 구성기를 반환하도록 수정
    function gptSystemInput() {
        // 선택정보가 있을 경우 보강, 없으면 기본 프롬프트로 처리
        const interviewTitle = window.interviewTitle || '모의 인터뷰';
        const selectedPersona = window.selectedPersona;
        const questions = Array.isArray(window.questions) ? window.questions : null;

        let content = `대화는 한국어로 진행됩니다. 사용자의 음성 발화를 받아 자연스럽게 한 사람처럼 대화하세요. 불필요한 이모지, 표는 사용하지 마세요.`;
        content += `\n인터뷰 주제: ${interviewTitle}`;
        if (selectedPersona) {
            content += `\n인터뷰 대상: ${selectedPersona.name} (${selectedPersona.gender || ''}, ${selectedPersona.age || ''}세, ${selectedPersona.occupation || ''})`;
            content += `\n성격: ${selectedPersona.personality || ''}`;
            content += `\n관심사: ${selectedPersona.interests || ''}`;
            if (selectedPersona.hobby) content += `\n취미: ${selectedPersona.hobby}`;
            if (selectedPersona.speech) content += `\n언어습관: ${selectedPersona.speech}`;

            // 말투 프롬프트 동적 생성
            // 기본값 또는 성격 기반 추론
            const accent = '한국 사투리';
            const emotionalRange = selectedPersona.personality?.includes('사교적') ? '일상 대화' : '경직';
            const intonation = selectedPersona.speech?.includes('논리적') ? '긴장' : '덜렁대는';
            const impressions = selectedPersona.personality?.includes('자신감') ? '웃음' : '진지한';
            const speed = selectedPersona.speech?.includes('여유로움') ? '보통' : '약간 빠름';
            const tone = selectedPersona.speech?.includes('외향적') ? 'sweet' : 'chill';
            const whispering = '없음';
            // 나이 데이터를 반영한 말투 프롬프트 적용. 30대 이하, 50대 이하, 50대 이상 구분
            if (selectedPersona.age && selectedPersona.age < 30) {
                content += `\n 음성 설정: 젊은 층의 목소리`;
            }   
            else if (selectedPersona.age && selectedPersona.age < 50) {
                content += `\n 음성 설정: 중년층의 차분한 목소리`;
            } else if (selectedPersona.age && selectedPersona.age >= 50) {
                content += `\n 음성 설정: 노년층의 중후한 목소리`;
            }
            content += `\n말투 설정:`;
            content += `\n- Accent: ${accent}`;
            content += `\n- Emotional range: ${emotionalRange}`;
            content += `\n- Intonation: ${intonation}`;
            content += `\n- Impressions: ${impressions}`;
            content += `\n- Speed of speech: ${speed}`;
            content += `\n- Tone: ${tone}`;
            content += `\n- Whispering: ${whispering}`;
        }
        if (questions) {
            content += `\n질문 리스트(순서): ${questions.join(',')}`;
            content += `\n사용자가 이전 질문에 대한 파생 질문을 하면 같은 질문 번호로 분류하고, 다른 질문에 가까우면 해당 질문 번호로 분류하세요.`;
            content += `\n가능하면 다음 질문 흐름을 자연스럽게 이어갈 수 있도록 간결히 답하세요.`;
        }
        return [
            { role: 'system', content }
        ];
    }

    // 음성 입력되는 이벤트 감지 후 callGPT 실행용 이벤트 출력하는 function
    async function callGPT(userText) {
        // gpt 프롬프트 준비
        const systemPrompt = gptSystemInput();

        // 기존 컨텍스트가 없으면 시스템프롬프트를 선행
        if (messages.length === 0) {
            messages = [...systemPrompt];
        }
        messages.push({ role: 'user', content: userText });

        const key = (document.getElementById('apiKeyInput')?.value || '').trim();
        if (!key) {
            alert('API 키를 입력해주세요.');
            return;
        }

        isPending = true;
        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: MODEL,
                    messages,
                    temperature: 0.7,
                    max_tokens: 512,
                    top_p: 1
                })
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`OpenAI API error ${res.status}: ${text}`);
            }
            const data = await res.json();
            const reply = data?.choices?.[0]?.message?.content || '';

            // 일부 프롬프트는 JSON을 요구할 수 있음. JSON이면 interviewAnswer 우선 추출
            let toSpeak = reply;
            try {
                const trimmed = reply.trim();
                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                    const json = JSON.parse(trimmed);
                    if (json.interviewAnswer) {
                        toSpeak = String(json.interviewAnswer);
                    }
                }
            } catch (_) {
                // JSON 파싱 실패시 원문 사용
            }

            appendMessage(toSpeak, 'bot');
            messages.push({ role: 'assistant', content: reply });

            // 봇의 답변을 음성으로 출력하고, 끝나면 자동으로 다시 듣기 시작
            speakText(toSpeak);
        } catch (error) {
            console.error(error);
            appendMessage('응답 중 오류가 발생했습니다. 콘솔을 확인해주세요.', 'bot');
        } finally {
            isPending = false;
        }
    }

    // 페이지 진입 시 자동으로 듣기 시작 (브라우저 정책상 차단될 수 있음. 크롬은 이상X)
    setTimeout(() => {
        try {
            safeStartRecognition();
        } catch (e) {
            console.warn('자동 마이크 시작이 차단되었습니다. 마이크 버튼을 눌러 시작하세요.');
        }
    }, 300);

    // 마이크 버튼으로 수동 토글도 가능하게 유지
    const micBtn = document.getElementById('micButton');
    if (micBtn) {
        micBtn.addEventListener('click', () => {
            if (isListening) {
                try { speechRecognition.stop(); } catch (_) {}
            } else if (!isSpeaking && !isPending) {
                safeStartRecognition();
            }
        });
    }

    // 탭 비활성화 시 리소스 보호
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            try { speechRecognition.stop(); } catch (_) {}
        } else {
            if (!isSpeaking && !isPending) safeStartRecognition();
        }
    });
});