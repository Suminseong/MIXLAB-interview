// ripple-input에 마우스 올릴 때 딱 한 번만 애니메이션
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.ripple-input').forEach(function(input) {
    input.addEventListener('mouseenter', function() {
      if (!input.classList.contains('ripple-animate')) {
        input.classList.add('ripple-animate');
      }
    });
    input.addEventListener('animationend', function() {
      input.classList.remove('ripple-animate');
    });
  });
});
document.addEventListener("DOMContentLoaded", () => {
    const navItems = Array.from(document.querySelectorAll("#nav-bar > div"));
    const subItems = document.querySelectorAll(".sub-upper .container-children");
    
    const personaBox = document.querySelector("#persona-side");
    const toggleInput = document.getElementById("toggle");
    const presetInput = document.getElementById("interviewTitle");
    const personaText = document.getElementById("personaTitle");
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
        
        // 토글이 checked 상태(자동생성 ON)이면 퍼소나 박스 숨김
        if (toggleInput.checked) {
            personaBox.style.display = "none";
        }

        subItems.forEach((subItem, index) => {
            if (subItem.classList.contains("sub-activate")) {
                showSideBoxes(subItem);
                toggleGenerationBoxes(index);
            }
        });
    }

    function switchMainPage(activeIndex) {
        // #result 안의 모든 페이지(.page)를 선택
        const pages = document.querySelectorAll("#result .page");
      
        pages.forEach((page, index) => {
          if (index === activeIndex) {
            // 활성화할 페이지: display를 block(또는 flex)으로 설정하고, opacity 0에서 1로 전환 (fade in)
            page.style.display = "block"; // 필요에 따라 "flex"로 변경 가능
            // 초기 opacity와 transition 설정
            page.style.opacity = 0;
            page.style.transition = "opacity 0.3s ease";
            
            // 강제로 reflow를 발생시켜 transition이 적용되도록 함 (선택사항)
            void page.offsetWidth;
            
            // 짧은 딜레이 후 opacity를 1로 변경하여 fade in 효과 적용
            setTimeout(() => {
              page.style.opacity = 1;
            }, 50);
          } else {
            // 비활성화할 페이지: fade out 효과 후 display를 none으로 설정
            page.style.transition = "opacity 0.3s ease";
            page.style.opacity = 0;
            
            // transition이 끝난 후 display를 none으로 변경 (여기서는 300ms 후)
            setTimeout(() => {
              page.style.display = "none";
            }, 300);
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
            switchMainPage(index);
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



    // 페이지 로드 시 초기 상태 설정
    initializePage();
});

// 마우스 커서 관련
// 클릭 가능한 요소들 지정
const interactiveTags = ["a", "button", "input", "textarea", "select"];
const cursor = document.querySelector(".custom-cursor");

document.addEventListener("mousemove", (e) => {
  cursor.style.left = `${e.clientX}px`;
  cursor.style.top = `${e.clientY}px`;

  const target = e.target;

  // 드래그/클릭 가능한 요소 위인지 확인
  const isHovering =
    interactiveTags.includes(target.tagName.toLowerCase()) ||
    target.closest("button, a, input, textarea, select, .clickable");

  if (isHovering) {
    cursor.classList.add("hovering");
  } else {
    cursor.classList.remove("hovering");
  }

  // 인트로 위인지 확인 (기존 로직 유지)
  const intro = document.getElementById("intro");
  const introRect = intro.getBoundingClientRect();
  const isInIntro =
    e.clientY >= introRect.top &&
    e.clientY <= introRect.bottom &&
    e.clientX >= introRect.left &&
    e.clientX <= introRect.right;

  if (isInIntro) {
    cursor.classList.remove("main-active");
  } else {
    cursor.classList.add("main-active");
  }
});

document.addEventListener("mousedown", () => {
  cursor.classList.add("click");
});
document.addEventListener("mouseup", () => {
  cursor.classList.remove("click");
});


// ----드래그 커서 숨기기
document.addEventListener("dragstart", (e) => {
  // 브라우저의 드래그 썸네일 제거
  e.dataTransfer.setDragImage(new Image(), 0, 0);
});
