document.addEventListener("DOMContentLoaded", () => {
    const countSpan = document.getElementById("count");
    const decreaseBtn = document.getElementById("decrease-btn");
    const increaseBtn = document.getElementById("increase-btn");

    let count = 8; // 기본 값

    decreaseBtn.addEventListener("click", () => {
        if (count > 1) {
            count--;
            countSpan.textContent = count;
        }
    });

    increaseBtn.addEventListener("click", () => {
        if (count < 12) { // 개수 제한
            count++;
            countSpan.textContent = count;
        }
    });

    
});