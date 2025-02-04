document.addEventListener("DOMContentLoaded", () => {
    const navItems = document.querySelectorAll("#nav-bar div");

    navItems.forEach(item => {
        item.addEventListener("click", function () {
            // 모든 항목에서 'nav-active' 제거
            navItems.forEach(nav => nav.classList.remove("nav-active"));

            // 현재 클릭한 항목에 'nav-active' 추가
            this.classList.add("nav-active");

            // 모든 아이콘의 색상 초기화
            document.querySelectorAll(".nav-img svg").forEach(svg => {
                svg.querySelector("path").setAttribute("fill", "#CDD1D6"); // 기본 색상
            });

            // 현재 클릭된 아이콘의 색상 변경
            const svg = this.querySelector(".nav-img svg");
            if (svg) {
                svg.querySelector("path").setAttribute("fill", "#5B5E63"); // 활성화 색상
            }
        });

        // SVG 이미지 파일을 직접 가져와서 대체
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
                        svg.querySelector("path").setAttribute("fill", "#CDD1D6"); // 기본 색상
                        img.replaceWith(svg);
                    }
                });
        }
    });
});
