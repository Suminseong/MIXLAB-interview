document.addEventListener("DOMContentLoaded", () => {
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
    let questionList;

    // GPT API 호출 (인터뷰 질문 생성)
    callQuestionGPT.addEventListener("click", async () => {
        const interviewTitle = interviewTitleInput.value.trim();
        const interviewPurpose = interviewFor.value.trim();

        if (!apiKey) {
            alert("API 키를 입력해야 합니다!");
            return;
        }

        if (!interviewTitle || !interviewPurpose) {
            alert("인터뷰 주제와 목적을 입력해주세요!");
            return;
        }

        

        // OpenAI API 요청 페이로드
        const payload = {
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: [{ text: `${interviewTitle}를 주제로 한 인터뷰는 ${interviewFor}을 목적으로 해야합니다. 이 인터뷰에서 해야하는는 질문을 ${questionNum}개 생성합니다. 인터뷰 질문은 인터뷰 순서에 맞게 구성되어야 하며, 개수는 user의 프롬프트에 기반합니다. 첫 질문은 인터뷰 주제에 대한 간단한 질문으로 시작합니다. 2번째 질문부터 본격적으로 목적에 맞게 질문을 작성하는데, 목적을 그대로 해석하지 말고, 목적으로부터 파생되는 심층적인 인사이트에 집중한 질문 생성을 기대합니다. 다음과 같은 이름을 부여한 인덱스로 내용을 채워 json 배열 타입으로 출력합니다. 이 양식 이외의 내용은 출력금지. json 형태로 출력하며, \n질문1\n질문2\n...\n이때, 숫자, 질문 인덱스 표시는 하지 않고, 텍스트만 큰 따옴표로 묶어서 넣고, 콤마를 삽입합니다. 그 밖의 내용은 절대 출력 금지. 개수를 정확히 준수합니다.`, type: "text" }] }],
            response_format: { type: "text" },
            temperature: 0.75,
            max_completion_tokens: 2048,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0
        };

        try {
            showLoading(); //로딩 호출기
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
                questionList = questions.join("/");
                console.log(questions)
                resultContainer.innerHTML = questions.map(q => `<p>${q}</p>`).join("");
            } else {
                resultContainer.innerHTML = "<p>질문을 생성하는데 실패했습니다.</p>";
            }
        } catch (error) {
            console.error("API 요청 중 오류 발생:", error);
            resultContainer.innerHTML = "<p>API 호출 오류. 콘솔을 확인하세요.</p>";
        } finally {
            hideLoading(); //로딩 철거장치
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

        resultContainer.innerHTML = "<p>퍼소나를 생성 중입니다...</p>"; //퍼소나 로딩 ui는 여기에 입력

        showLoading();
        personaResults = [];

        for (let i = 0; i < personaNum; i++) {
            const promptText = personaPrompts[i] || ""
            const payload = {
                model: "gpt-4o-2024-08-06",
                messages: [{ role: "system", content: [{ text: `인터뷰에서 사용할 ${i + 1}번째 퍼소나를 생성해주세요. 인터뷰 주제는 '${interviewTitle}'입니다. '${promptText ? `이 퍼소나는 반드시 ${promptText}를 기반으로 만들어야 하며, 지정된 내용의 누락이 없어야 합니다.` : ""}' 퍼소나는 현실적인 직업, 연령, 성격, 관심사를 가지고 있어야 하며, 인터뷰에서 논의될 주제와 관련성이 있어야 합니다. \n이 양식으로 출력합니다:\n{\n"name": "퍼소나 성명",\n "gender": "퍼소나 성별", \n"age": "연령",\n"occupation": "직업",\n"personality": "성격",\n"interests": "관심사",\n"hobby": "취미",\n"speech": "언어습관",}\n그 밖의 내용은 출력하지 마세요. JSON 형식만 반환하세요. 이름은 성별에 맞추고, 반드시 한국식 3글자 이름으로 작성합니다. 직업은 '소속 부서 직급'순으로 기입하며, 예를 들어, '삼성증권 영업부 대리', '경원상사 재경부 부장' 입니다. 또는 프리랜서, 무직, 학생같은 형태도 상관 없습니다. \n 만약 지금 만드는 퍼소나가 3번째라면, 성격은 '매우 비관적', '공격적이고 꼬장꼬장함', '성질이 더럽고 짜증이 많음', '매우 소심하고 내성적' 등 과 같이 사회성이 매우 떨어지는 형태로 작성합니다. 3번째가 아닌 퍼소나는 평범하고 사회성 있는 성격으로 작성 합니다. \n 언어습관은 퍼소나의 말하기 방식을 정하는 것이며, 딱딱함/여유로움움, 내성적/외향적, 의기소침/자신감, 공격적/방어적, 단답형/장문형, 논리적/단편형에서, 각 선택지 한개씩 전부 반드시 골라야 함. 3의 배수 퍼소나라면 그에 맞춰 이야기 하기 까다로운 사용자를 만듭니다. \n 출력방식 json 타입을 꼭 지키도록 하며, {}괄호 전후로 아무것도 입력금지.`, type: "text" }] }],
                response_format: { type: "text" },
                temperature: 0.95,
                max_completion_tokens: 980,
                top_p: 1,
                frequency_penalty: 0.4,
                presence_penalty: 0.2
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
                    const persona = JSON.parse(data.choices[0].message.content);
                    console.log(data.choices[0].message.content);
                    personaResults.push(persona);
                }
            } catch (error) {
                console.error(`퍼소나 ${i + 1} 생성 중 오류 발생:`, error);
                personaNum ++;
            }
        }

        hideLoading();

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

        // 퍼소나 내용물 나오는 부분. class이름 persona 박스니까 css 먹이기. 일단 대충 만들어둔 거니까 스타일 부분은 지워버리셔도 됨니다

        document.querySelectorAll(".select-persona-btn").forEach(button => {
            button.addEventListener("click", (event) => {
                const index = event.target.getAttribute("data-index");
                selectPersona(index);
            });
        });
    });

    window.selectPersona = function (index) {
        selectedPersona = personaResults[index]; // 선택한 퍼소나 저장
    
        alert(`${selectedPersona.name} 퍼소나를 선택하였습니다.`);
        if (personaResults.length === 0) {
            alert("퍼소나 데이터가 없습니다.");
            return;
        }
        if (typeof switchMainPage === "function") {
            switchMainPage(2); // Interview 페이지로 이동
        } else {
            console.error("switchMainPage 함수가 존재하지 않습니다.");
        }
    
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
    const micButton = document.getElementById('micButton'); // 음성 입력 버튼 추가
    let nowQuestion;

    const audioElement = new Audio(); // 오디오 재생을 위한 HTMLAudioElement

    //야옹야옹 여기가 거기
    let indexMessage = [
        {
            role: "system",
            content: `인터뷰에는 미리 정해진 질문들이 있는데, 질문 리스트는 ${questions}순 입니다. 질문을 받는 것은 아이스 브레이킹 > 1번 질문 > 1번의 파생질문들 > 2번 질문 > ... > 마지막 질문 순서로 이루어 지는데, 지금 받은 질문이 어떤 것인지를 **interiewIndex**라고 정의합니다. 오직 숫자만 들어가며, 아이스브레이킹이나 자기소개=0, 1번 질문과 그 파생질문=1, 2번 질문과 그 파생질문=2... 로 숫자만 표시합니다. 이전 질문에 대해 상세히 물어보거나 파생된 질문을 했을 경우에는 파생질문으로 인식하고 가장 최근과 동일한 번호를 부여하되, 다른 질문 목록에 있는 질문에 더 가깝다면 그 질문의 번호를 부여합니다. 인터뷰 초반에 주제 또는 질문 리스트와 관련 없는 이야기를 하고 있다면 아이스브레이킹으로 간주하고 0을 출력합니다.` + `만약 사용자 입력이 어떤 질문과 동일, 또는 매우 유사하다면 그 질문 순서와 동일한 index를 부여합니다. 모든 판단은 질문 리스트에 우선합니다.` +
            `최종 출력은 단일 숫자로 하며, 괄호, 백틱이나 다른 글자를 넣지 마세요.`
        }
    ];
    
    async function callNewGPTApi() {
        const userMessage = userInput.value.trim();
        if (!userMessage) {
            alert('메시지를 입력해주세요.');
            return;
        }
    
        // 사용자 입력을 indexMessage 배열에 추가
        indexMessage.push({ role: "user", content: userMessage });
    
        const payload = {
            model: "gpt-4o-2024-08-06",
            messages: indexMessage, // 이전 대화 내역 유지
            max_tokens: 100,
            temperature: 0.0,
            top_p: 1.0
        };
    
        try {
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKeyInput.value.trim()}`
                },
                body: JSON.stringify(payload)
            });
    
            if (!response.ok) throw new Error(`Error: ${response.statusText}`);
    
            const data = await response.json();
            nowQuestion = data.choices[0]?.message?.content || "응답이 없습니다.";
    
            console.log("GPT Output:", nowQuestion);
    
            // GPT 응답을 indexMessage 배열에 추가 (다음 호출에서 기억되도록)
            indexMessage.push({ role: "assistant", content: nowQuestion });
        } catch (error) {
            console.error("Error calling GPT API:", error);
        }
    }
    

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
            console.log("웹소켓 가동!");
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

    function appendMessage(message, sender) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}`;
        messageElement.textContent = message;
        chatbox.appendChild(messageElement);
        chatbox.scrollTop = chatbox.scrollHeight;
    }

    async function sendMessage() {
        const apiKey = apiKeyInput.value.trim();
        const userMessage = userInput.value.trim();

        if (!apiKey) {
            alert('API 키를 입력해주세요.');
            return;
        }
        if (!userMessage) {
            alert('메시지를 입력해주세요.');
            return;
        }

        callNewGPTApi();

        // 퍼소나가 선택되지 않은 경우 경고 후 함수 종료
        if (!selectedPersona) {
            alert("먼저 퍼소나를 선택해주세요.");
            return;
        }

        const interviewTitle = interviewTitleInput.value.trim();

        // 시스템 메시지에 GPT 퍼소나 JSON의 주요 정보를 포함하여 구성
        messages = [
            {
                role: "system",
                content:
                    `인터뷰 주제: ${interviewTitle}\n` +
                    `인터뷰 대상: ${selectedPersona.name} (${selectedPersona.gender}, ${selectedPersona.age}세, ${selectedPersona.occupation})\n` +
                    `성격: ${selectedPersona.personality}\n` +
                    `관심사: ${selectedPersona.interests}\n` +
                    `취미: ${selectedPersona.hobby}\n` +
                    `언어습관: ${selectedPersona.speech}\n` +
                    `위 정보를 바탕으로, 사용자가 제출한 자료에 맞는 가상의 인물로 연기해주세요. 누적된 응답들을 기억하고 개연성 있는 대화를 합니다.` +
                    `대화는 반드시 대화체로, 불필요한 표, 단락, 이모지는 사용하지 않고, 즐거운 상황에서는 하하하하! 하고 웃거나, 언어습관에 따라 대답을 거부하거나, 말문이 막힌 연기를 하거나, 특히 성격이 안좋다면 반복되는 질문을 귀찮아 하고, 한숨도 쉬고, 쉽게 화 냅니다. 실제 사람같은 응답을 원해요. 이렇게 출력된 답은 순수 텍스트만 들어갑니다.`
            }
        ];

        appendMessage(userMessage, 'user');
        messages.push({ role: "user", content: userMessage });
        userInput.value = '';

        const payload = {
            model: modelId,
            messages: messages,
            max_tokens: 4800,
            temperature: 0.7,
            top_p: 1,
            frequency_penalty: 0.02,
            presence_penalty: 0.06
        };

        try {
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.statusText}`);
            }

            const data = await response.json();
            const botMessage = data.choices[0]?.message?.content || "Error: API에서 응답이 없습니다.";

            appendMessage(botMessage, 'bot');
            messages.push({ role: "assistant", content: botMessage });

            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ apiKey, gptResponse: botMessage }));
                console.log("메시지 전송됨:", { apiKey, gptResponse: botMessage });
            } else {
                console.warn("웹소켓 연결이 중단되었습니다.");
            }
        } catch (error) {
            appendMessage(`Error: ${error.message}`, 'bot');
        }
    }


    let isTalked = false;

    function enableSpeechInput() {
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = "ko-KR";
        recognition.interimResults = false;

        recognition.onstart = () => {
            console.log("음성 인식중");
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log("Recognized speech:", transcript);
            userInput.value = transcript;
            isTalked = true;
            sendMessage();
            isTalked = false;
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
        };

        recognition.onend = () => {
            console.log("Voice recognition ended.");
        };

        recognition.start();
    }

    sendButton.addEventListener('click', sendMessage);
    micButton.addEventListener('click', enableSpeechInput); // 마이크 버튼 이벤트
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' || isTalked) {
            sendMessage();
            isTalked = false; // 상태 초기화
        }
    });

    connectWebSocket();

});
