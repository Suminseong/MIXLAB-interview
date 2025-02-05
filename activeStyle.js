document.addEventListener("DOMContentLoaded", () => {
    const navItems = Array.from(document.querySelectorAll("#nav-bar > div"));
    const subItems = document.querySelectorAll(".sub-upper .container-children");
    const personaBox = document.querySelector("#persona-side");
    const toggleInput = document.getElementById("toggle");
    const presetInput = document.getElementById("interviewTitle");
    const personaText = document.getElementById("personaTitle");

    // 추가할 요소
    const genQuestionBox = document.getElementById("gen-question");
    const genPersonaBox = document.getElementById("gen-persona");

    if (presetInput && personaText) {
        presetInput.addEventListener("input", () => {
            personaText.textContent = presetInput.value || "인터뷰 주제를 입력해주세요.";
        });
    }

    function hideSideBoxes(subItem, callback) {
        const sideBoxes = Array.from(subItem.querySelectorAll(".side-box"));
        sideBoxes.reverse().forEach((box, i) => {
            setTimeout(() => {
                box.style.opacity = "0";
                box.style.transform = "translateY(-10px)";
                box.style.transition = "opacity 0.2s ease, transform 0.2s ease";
            }, i * 100);
        });

        setTimeout(() => {
            subItem.classList.remove("sub-activate");
            subItem.classList.add("sub-inactive");
            subItem.style.display = "none";
            callback();
        }, sideBoxes.length * 100 + 200);
    }

    function showSideBoxes(subItem) {
        subItem.style.display = "flex";
        setTimeout(() => {
            subItem.classList.remove("sub-inactive");
            subItem.classList.add("sub-activate");
            const sideBoxes = Array.from(subItem.querySelectorAll(".side-box"));
            sideBoxes.forEach((box, i) => {
                setTimeout(() => {
                    box.style.opacity = "1";
                    box.style.transform = "translateY(0px)";
                    box.style.transition = "opacity 0.3s ease, transform 0.3s ease";
                }, i * 100);
            });
        }, 50);
    }

    function toggleGenerationBoxes(index) {
        if (index === 0) { // sub-preset 활성화 (질문 생성 버튼 보이기)
            
            genQuestionBox.style.opacity = "0";
            genQuestionBox.style.transform = "translateY(10px)";
            setTimeout(() => {
                genQuestionBox.style.display = "flex";
                genQuestionBox.style.opacity = "1";
                genQuestionBox.style.transform = "translateY(0)";
                genQuestionBox.style.transition = "opacity 0.3s ease, transform 0.3s ease";
            }, 320);
    
            // 퍼소나 생성 버튼 부드럽게 숨기기
            genPersonaBox.style.opacity = "0";
            genPersonaBox.style.transform = "translateY(-10px)";
            genPersonaBox.style.transition = "opacity 0.2s ease, transform 0.2s ease";
            setTimeout(() => {
                genPersonaBox.style.display = "none";
            }, 320);
    
        } else if (index === 1) { // sub-persona 활성화 (퍼소나 생성 버튼 보이기)
            
            genPersonaBox.style.opacity = "0";
            genPersonaBox.style.transform = "translateY(10px)";
            setTimeout(() => {
                genPersonaBox.style.display = "flex";
                genPersonaBox.style.opacity = "1";
                genPersonaBox.style.transform = "translateY(0)";
                genPersonaBox.style.transition = "opacity 0.3s ease, transform 0.3s ease";
            }, 320);
    
            // 질문 생성 버튼 부드럽게 숨기기
            genQuestionBox.style.opacity = "0";
            genQuestionBox.style.transform = "translateY(-10px)";
            genQuestionBox.style.transition = "opacity 0.2s ease, transform 0.2s ease";
            setTimeout(() => {
                genQuestionBox.style.display = "none";
            }, 320);
    
        } else { // 다른 탭에서는 둘 다 숨김
            genQuestionBox.style.opacity = "0";
            genQuestionBox.style.transform = "translateY(-10px)";
            genQuestionBox.style.transition = "opacity 0.2s ease, transform 0.2s ease";
            setTimeout(() => {
                genQuestionBox.style.display = "none";
            }, 300);
    
            genPersonaBox.style.opacity = "0";
            genPersonaBox.style.transform = "translateY(-10px)";
            genPersonaBox.style.transition = "opacity 0.2s ease, transform 0.2s ease";
            setTimeout(() => {
                genPersonaBox.style.display = "none";
            }, 300);
        }
    }
    

    function initializePage() {
        // 기본적으로 'Preset'이 활성화되어 있다고 가정
        genQuestionBox.style.display = "flex";  // 질문 생성 버튼 표시
        genPersonaBox.style.display = "none";  // 퍼소나 생성 버튼 숨김

        subItems.forEach((subItem, index) => {
            if (subItem.classList.contains("sub-activate")) {
                toggleGenerationBoxes(index);
            }
        });
    }

    navItems.forEach((item, index) => {
        item.addEventListener("click", function () {
            navItems.forEach(nav => nav.classList.remove("nav-active"));
            this.classList.add("nav-active");

            document.querySelectorAll(".nav-img svg").forEach(svg => {
                svg.querySelector("path").setAttribute("fill", "#CDD1D6");
            });

            const svg = this.querySelector(".nav-img svg");
            if (svg) {
                svg.querySelector("path").setAttribute("fill", "#5B5E63");
            }

            const currentActive = document.querySelector(".sub-activate");

            if (currentActive) {
                hideSideBoxes(currentActive, () => {
                    showSideBoxes(subItems[index]);
                    toggleGenerationBoxes(index);
                });
            } else {
                showSideBoxes(subItems[index]);
                toggleGenerationBoxes(index);
            }
        });

        const img = item.querySelector(".nav-img img");
        if (img) {
            fetch(img.src)
                .then(response => response.text())
                .then(data => {
                    const div = document.createElement("div");
                    div.innerHTML = data;
                    const svg = div.querySelector("svg");

                    if (svg) {
                        svg.setAttribute("width", "24");
                        svg.setAttribute("height", "24");
                        svg.querySelector("path").setAttribute("fill", "#CDD1D6");
                        img.replaceWith(svg);
                    }
                });
        }
    });

    function togglePersonaBox() {
        const personaPromptBoxes = Array.from(personaBox.querySelectorAll(".persona-prompt-box"));

        if (toggleInput.checked) {
            personaPromptBoxes.reverse().forEach((box, i) => {
                setTimeout(() => {
                    box.style.opacity = "0";
                    box.style.transform = "translateY(-10px)";
                    box.style.transition = "opacity 0.2s ease, transform 0.2s ease";
                }, i * 100);
            });

            setTimeout(() => {
                personaBox.style.opacity = "0";
                personaBox.style.transform = "translateY(-10px)";
                personaBox.style.transition = "opacity 0.2s ease, transform 0.2s ease";
            }, personaPromptBoxes.length * 100);

            setTimeout(() => {
                personaBox.style.display = "none";
            }, personaPromptBoxes.length * 100 + 200);

        } else {
            personaBox.style.display = "flex";
            setTimeout(() => {
                personaBox.style.opacity = "1";
                personaBox.style.transform = "translateY(0px)";
                personaBox.style.transition = "opacity 0.3s ease, transform 0.3s ease";
            }, 50);

            personaPromptBoxes.forEach((box, i) => {
                setTimeout(() => {
                    box.style.opacity = "1";
                    box.style.transform = "translateY(0px)";
                    box.style.transition = "opacity 0.3s ease, transform 0.3s ease";
                }, i * 100);
            });
        }
    }

    toggleInput.addEventListener("change", togglePersonaBox);

    // 🌟 페이지 로드 시 초기 상태 설정
    initializePage();
});
