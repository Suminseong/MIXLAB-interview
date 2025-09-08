document.addEventListener("DOMContentLoaded", () => {
    // 음성 인식 기능 (Web Speech API)
    let recognition;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'ko-KR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        micButton.addEventListener('click', () => {
            recognition.start();
            micButton.disabled = true;
            micButton.textContent = '...';
        });

        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            sendButton.click();
        };
        recognition.onerror = function(event) {
            alert('음성 인식 오류: ' + event.error);
        };
        recognition.onend = function() {
            micButton.disabled = false;
            micButton.textContent = '🎤';
        };
    } else {
        micButton.addEventListener('click', () => {
            alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
        });
    }
    // 퍼소나 슬라이드 관련
    let personaPageIndex = 0;
    const personaSlideContainer = document.getElementById("persona-container");
    const personaLeftBtn = document.getElementById("personaLeftBtn");
    const personaRightBtn = document.getElementById("personaRightBtn");

    function getPersonaCount() {
        return personaSlideContainer ? personaSlideContainer.children.length : 0;
    }
    function getGridSize() {
        // 한 번에 보여줄 개수 (슬라이딩 윈도우)
        return 2;
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
    // 모달 X버튼 클릭 시 닫기
    const apiKeyModalClose = document.querySelector('.api-key-modal-close');
    if (apiKeyModalClose && apiKeyModal) {
        apiKeyModalClose.addEventListener('click', function() {
            apiKeyModal.classList.remove('active');
        });
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
        changeApiKeyBtn.addEventListener('click', function(e) {
            apiKeyModal.classList.add('active');
        });
        apiKeyModal.addEventListener('mousedown', function(e) {
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
                      btn.addEventListener('click', function(e) {
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
        // persona-box 렌더링
        personaContainer.innerHTML = personaResults.map((p, index) => {
            const imgSrc = getRandomImage(p.gender);
            // 선택된 퍼소나 객체에 image 경로를 저장
            p.image = imgSrc;
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
            box.addEventListener('click', function() {
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

document.getElementById('goToInterviewBtn').addEventListener('click', function() {
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
        option.addEventListener('click', function() {
            // 기존 선택 해제
            document.querySelectorAll('.time-option').forEach(opt => opt.classList.remove('selected'));
            // 현재 선택 표시
            this.classList.add('selected');
            interviewDuration = parseInt(this.getAttribute('data-time'));
            console.log('선택된 시간:', interviewDuration); // 디버깅용
        });
    });
    
    // 확인 버튼 클릭
    document.getElementById('timeModalConfirm').addEventListener('click', function() {
        console.log('확인 버튼 클릭, interviewDuration:', interviewDuration); // 디버깅용
        if (!interviewDuration || interviewDuration <= 0) {
            alert('인터뷰 시간을 선택해주세요.');
            return;
        }
        hideInterviewTimeModal();
        startInterview();
    });
    
    // 취소 버튼 클릭
    document.getElementById('timeModalCancel').addEventListener('click', function() {
        hideInterviewTimeModal();
    });
    
    // 모달 외부 클릭 시 닫기
    document.getElementById('interviewTimeModal').addEventListener('click', function(e) {
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
            console.log('타이머 종료, 인터뷰 종료 호출'); // 디버깅용
            endInterview();
        }
    }, 1000);
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function endInterview() {
    // 타이머 정지
    if (interviewTimer) {
        clearInterval(interviewTimer);
        interviewTimer = null;
    }
    
    // 인터뷰 종료 팝업 표시
    showInterviewEndModal();
}

function showInterviewEndModal() {
    // 인터뷰 종료 모달 생성
    const modal = document.createElement('div');
    modal.id = 'interviewEndModal';
    modal.style.cssText = `
        display: flex;
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(255, 255, 255, 0.95);
        z-index: 10001;
        justify-content: center;
        align-items: center;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 3rem;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        text-align: center;
        max-width: 400px;
        width: 90%;
    `;
    
    modalContent.innerHTML = `
        <h3 style="margin-bottom: 1.5rem; color: #333; font-size: 1.5rem;">인터뷰가 종료되었습니다.</h3>
        <button id="goToAnalysisBtn" style="
            padding: 1rem 2rem;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            cursor: pointer;
            transition: background 0.3s ease;
        ">인터뷰 분석 결과 보러가기</button>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // 분석 페이지로 이동 버튼 이벤트
    document.getElementById('goToAnalysisBtn').addEventListener('click', function() {
        // 모달 제거
        document.body.removeChild(modal);
        // 분석 페이지로 이동
        document.querySelector('.btn-analysis').click();
    });
}



    //아래는 음성처리부분/////////////////////////////////////////////////////////////////////////////////////////////////////////

    const apiUrl = "https://api.openai.com/v1/chat/completions";
    const modelId = "ft:gpt-4o-2024-08-06:chamkkae:chamkkae-v3a:AmwkrRHc";

    const chatbox = document.getElementById('chatbox');

    const audioElement = new Audio(); // 오디오 재생을 위한 HTMLAudioElement

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

            // 채팅박스 내에서만 스크롤하도록 수정
            chatbox.scrollTop = chatbox.scrollHeight;
        } else {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${sender}`;
            messageElement.textContent = message;
            chatbox.appendChild(messageElement);

            // 채팅박스 내에서만 스크롤하도록 수정
            chatbox.scrollTop = chatbox.scrollHeight;
        }

        // 전체 페이지 스크롤은 제거
        // chatbox.scrollTop = chatbox.scrollHeight; // 이미 위에서 처리함
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

    let interviewLog = []; // 인터뷰 Q&A 기록용
    let sendStartTime = null;

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
                    `위 정보를 바탕으로, 사용자가 제출한 자료에 맞는 가상의 인물로 연기해주세요. ` +
                    `대화는 반드시 대화체로, 불필요한 표, 단락, 이모지는 사용하지 않고, 즐거운 상황에서는 하하하하! 하고 웃거나, 언어습관에 따라 대답을 거부하거나, 말문이 막힌 연기를 하거나, 특히 성격이 안좋다면 반복되는 질문을 귀찮아 하고, 한숨도 쉬고, 쉽게 화 냅니다. 실제 사람같은 응답을 원해요. 이렇게 출력된 답은 **interviewAnswer**라고 정의합니다. 순수 텍스트만 들어갑니다.` +
                    `인터뷰에는 미리 정해진 질문들이 있는데, 질문 리스트는 ${questions.join(',')}순 입니다. 질문을 받는 것은 아이스 브레이킹 > 1번 질문 > 1번의 파생질문들 > 2번 질문 > ... > 마지막 질문 순서로 이루어 지는데, 지금 받은 질문이 어떤 것인지를 **interiewIndex**라고 정의합니다. 오직 숫자만 들어가며, 아이스브레이킹=0, 1번 질문과 그 파생질문=1, 2번 질문과 그 파생질문=2... 로 숫자만 표시합니다. 이전 질문에 대해 상세히 물어보거나 파생된 질문을 했을 경우에는 파생질문으로 인식하고 이전 질문과 같은 번호를 부여하되, 다른 질문 목록에 있는 질문에 더 가깝다면 그 질문의 번호를 부여합니다.` +
                    `최종 출력은 json 형태로 하되 괄호 전후로 백틱이나 다른 글자를 넣지 마세요. interviewAnswer, interviewIndex 2가지 속성만 넣어 출력하세요.`
            }
        ];

        appendMessage(userMessage, 'user');
        messages.push({ role: "user", content: userMessage });
        userInput.value = '';

        const payload = {
            model: modelId,
            messages: messages,
            max_tokens: 4000,
            temperature: 0.7,
            top_p: 1,
            frequency_penalty: 0.02,
            presence_penalty: 0.06
        };

        sendStartTime = Date.now(); // 유저 입력 시각 기록

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

            try {
                const parsed = JSON.parse(botMessage);
                const answerText = parsed.interviewAnswer;
                const index = parseInt(parsed.interviewIndex);

                highlightCurrentQuestion(index);

                // 안내 문구 삽입 조건
                if (index === 0 && lastIndex === 0 && !chatbox.querySelector('.stage-message')) {
                    appendStageMessage("아이스브레이킹을 진행하세요");
                } else if (index > 0 && lastIndex === 0) {
                    appendStageMessage("인터뷰를 시작합니다");
                }

                lastIndex = index;

                appendMessage(answerText, 'bot');
                messages.push({ role: "assistant", content: answerText });
                // 인터뷰 로그 기록
                const endTime = Date.now();
                interviewLog.push({
                    questionIndex: index,
                    question: questions && questions[index - 1] ? questions[index - 1] : "(파생 질문)",
                    userMessage: userMessage,
                    botAnswer: answerText,
                    timestampStart: sendStartTime,
                    timestampEnd: endTime
                });

                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ apiKey, gptResponse: answerText }));
                    console.log("메시지 전송됨:", { apiKey, gptResponse: answerText });
                } else {
                    console.warn("웹소켓 연결이 중단되었습니다.");
                }
            } catch (err) {
                console.error("GPT 응답 파싱 오류:", err);
                appendMessage(botMessage, 'bot'); // fallback 처리
            }

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

    // document.getElementById("endInterviewBtn").addEventListener("click", () => {
    //     document.getElementById("interview-page").style.display = "none";
    //     document.getElementById("analyze-page").style.display = "block";

    //     document.querySelector(".sub-interview").classList.add("sub-inactive");
    //     document.querySelector(".sub-analysis").classList.remove("sub-inactive");

    //     // 수정사항 ->인터뷰 종료 버튼 누르면 다음 페이지로 이동하게
    //     if (typeof switchMainPage === "function") {
    //         switchMainPage(3); // Analysis 탭의 index가 3
    //     }

    //     if (typeof window.renderAnalysis === "function") {
    //         window.renderAnalysis();
    //     } else {
    //         console.warn("renderAnalysis 함수가 정의되어 있지 않습니다. script.js를 확인하세요.");
    //     }
    // });

    // 인터뷰 종료 버튼 이벤트 - 타이머 기능과 연동
    document.getElementById("endInterviewBtn").addEventListener("click", () => {
        endInterview();
    });

    // ===================== 분석 대시보드 렌더링 =====================

    // 분석 대시보드 렌더링 함수
    function renderAnalysisDashboard() {
        // 1. Bar Chart (질문별 응답 시간)
        const barCtx = document.getElementById('barChart').getContext('2d');
        if (window.barChartInstance) window.barChartInstance.destroy();
        const barLabels = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];
        const barData = [35, 60, 28, 32, 36, 40, 38, 15];
        window.barChartInstance = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: barLabels,
                datasets: [{
                    label: '응답 시간(초)',
                    data: barData,
                    backgroundColor: barData.map((v, i) => i === 1 ? '#5872FF' : '#DDE2EB'),
                    borderRadius: 12,
                    barPercentage: 0.6,
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        min: 0,
                        max: 90,
                        ticks: { stepSize: 10, color: '#B0B4BC', font: { size: 13 } },
                        grid: { color: '#F2F3F5' }
                    },
                    x: {
                        ticks: { color: '#B0B4BC', font: { size: 13 } },
                        grid: { display: false }
                    }
                }
            }
        });

        // 2. 도넛 차트 (인터뷰 종합 시간)
        const donutCtx = document.getElementById('donutChart').getContext('2d');
        if (window.donutChartInstance) window.donutChartInstance.destroy();
        window.donutChartInstance = new Chart(donutCtx, {
            type: 'doughnut',
            data: {
                labels: ['진행', '남은 시간'],
                datasets: [{
                    data: [15, 5],
                    backgroundColor: ['#5872FF', '#F2F3F5'],
                    borderWidth: 0
                }]
            },
            options: {
                cutout: '75%',
                plugins: { legend: { display: false } },
                responsive: false
            }
        });
        document.getElementById('donutPercent').textContent = '80%';

        // 3. 키워드 클라우드 (d3-cloud)
        const keywords = [
            { text: '사용성', size: 24 },
            { text: '편의성', size: 16 },
            { text: '저렴한', size: 9 },
            { text: '이웃주민', size: 7.5 },
            { text: '친절', size: 18.5 },
            { text: '거래', size: 9.5 },
            { text: '미소', size: 7.5 },
            { text: '추억', size: 10 },
            { text: '소통', size: 9 }

        ];
        const cloudEl = document.getElementById('keywordCloud');
        cloudEl.innerHTML = '';
        const w = 180, h = 80; // SVG 영역을 줄여 여백 최소화
        const svg = d3.select(cloudEl).append('svg').attr('width', w).attr('height', h);
        d3.layout.cloud().size([w, h])
            .words(keywords)
            .padding(1)
            .rotate(() => 0)
            .font('Pretendard Variable')
            .fontSize(d => d.size)
            .on('end', drawCloud)
            .start();
        function drawCloud(words) {
            svg.append('g')
                .attr('transform', `translate(${w / 2},${h / 2})`)
                .selectAll('text')
                .data(words)
                .enter().append('text')
                .style('font-size', d => d.size + 'px')
                .style('fill', (d, i) => i === 2 ? '#5872FF' : '#B0B4BC')
                .style('font-family', 'Pretendard Variable')
                .attr('text-anchor', 'middle')
                .attr('transform', d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
                .text(d => d.text);
        }

        // 4. 요약/피드백
        document.getElementById('summaryText').textContent =
            '유지연씨는 환경보호에 관심이 많지만 본인의 편리함을 위해 일회용품을 사용하는 경우가 많습니다.';
        document.getElementById('feedbackList').innerHTML = `
            <li>놓친 질문 포인트<br>인터뷰 목적에 따라 추가했으면 좋았던 질문</li>
            <li>AI 기반 질문 리비전<br>인터뷰 전체를 기반으로 AI가 추천하는 리비전 질문 목록</li>
            <li>퍼소나 친밀도 추이 그래프<br>시간 경과에 따라 친밀도가 어떻게 변했는지 (선 그래프)</li>
        `;

        // 5. 친밀도 스텝 (예시: 1단계 활성)
        document.querySelectorAll('.affinity-step').forEach((el, i) => {
            el.classList.toggle('active', i === 0);
        });
        // 6. 말의 속도 (예시: 85%)
        document.getElementById('speedBar').style.width = '85%';
        document.querySelector('.speed-label').textContent = '85% 조금 빨랐어요';
        // 7. 언어습관 피드백 (예시)
        document.getElementById('langFeedbackList').innerHTML = `
            <li>문장을 읽는 중간에 말을 더듬는 습관이 있어요.</li>
            <li>인터뷰 질문지를 미리 읽는 연습을 통해 말 더듬는 습관을 개선해 보세요!</li>
        `;
    }

    // 분석페이지 진입 시 자동 렌더링 (탭 연동 시 아래 코드 위치 조정)
    if (document.getElementById('analyze-page')) {
        renderAnalysisDashboard();
    }

    document.getElementById("sendButton").addEventListener("click", sendMessage);
    document.getElementById("userInput").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault(); // Enter 키의 기본 동작 방지
            sendMessage();
        }
    });
    micButton.addEventListener("click", () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: "startRecording" }));
            console.log("음성 녹음 시작");
        } else {
            console.warn("웹소켓 연결이 중단되었습니다.");
        }
    }   );
    
    const globalAddBtn = document.getElementById("global-question-add-btn");
    let currentHoverIndex = null;


    document.addEventListener("mouseover", (e) => {
        const wrapper = e.target.closest(".question-edit-wrapper");
        if (!wrapper) return;

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

    globalAddBtn.addEventListener("click", () => {
        if (typeof questions === 'undefined') return;
        // 현재 마우스가 올라간 row 인덱스 새로 계산 (혹시 currentHoverIndex가 null이거나 잘못된 경우)
        let wrappers = Array.from(document.querySelectorAll('.question-edit-wrapper'));
        let hoverIdx = wrappers.findIndex(w => w.contains(globalAddBtn));
        if (hoverIdx === -1) hoverIdx = currentHoverIndex;
        if (hoverIdx == null || hoverIdx < -1) hoverIdx = wrappers.length - 1;

        // 현재 입력값 저장
        const inputs = document.querySelectorAll('.question-edit-input');
        inputs.forEach(input => {
            const idx = parseInt(input.dataset.index);
            if (!isNaN(idx) && idx < questions.length) {
                questions[idx] = input.value;
            }
        });

        // 새 질문 추가
        questions.splice(hoverIdx + 1, 0, "");
        questionNum = questions.length;
        const questionNumSpan = document.getElementById('count');
        if (questionNumSpan) questionNumSpan.textContent = questionNum;
        renderQuestions();
        // 새로 추가된 질문 input에 자동 포커스
        setTimeout(() => {
            const wrappers = document.querySelectorAll('.question-edit-wrapper');
            const newWrapper = wrappers[hoverIdx + 1];
            if (newWrapper) {
                const input = newWrapper.querySelector('input.question-edit-input');
                if (input) {
                    input.focus();
                    input.select();
                }
            }
        }, 0);
    });

    // #closeApiKeyModal 버튼 누르면 #apiKeyModal의 active class 제거
    const closeApiKeyModalBtn = document.getElementById("closeApiKeyModal");
    if (closeApiKeyModalBtn && apiKeyModal) {
        closeApiKeyModalBtn.addEventListener('click', function() {
            apiKeyModal.classList.remove('active');
        });
    }
});

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
