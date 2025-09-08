// loading.js
document.addEventListener('DOMContentLoaded', () => {
    const loader = document.createElement('div');
    loader.id = 'loading-overlay';
    loader.style.display = 'none';  
    loader.style.position = 'fixed';
    loader.style.top = '0';
    loader.style.left = '0';
    loader.style.width = '100%';
    loader.style.height = '100%';
    loader.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    loader.style.zIndex = '9999';
    loader.style.justifyContent = 'center';
    loader.style.alignItems = 'center';
    loader.style.fontSize = '1.5rem';
    loader.style.color = '#555';
    loader.style.fontWeight = 'bold';
    loader.style.transition = 'opacity 0.3s ease';

    loader.innerText = 'Loading...';

    document.body.appendChild(loader);
});

function showLoading() {
    const loader = document.getElementById('loading-overlay');
    if (loader) {
        loader.style.display = 'flex';
        loader.style.opacity = '1';
    }
}

function hideLoading() {
    const loader = document.getElementById('loading-overlay');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 300);
    }
}
