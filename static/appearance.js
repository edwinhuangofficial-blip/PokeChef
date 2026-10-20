// Decorative images never participate in chat or team analysis.
(() => {
    const app = document.querySelector('.app');
    const background = document.getElementById('pokemon-background');
    const selector = document.getElementById('art-style');
    const about = document.getElementById('about-dialog');
    const settings = document.getElementById('settings-dialog');
    const spriteBase = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/';
    let style = 'pixel';
    try { style = localStorage.getItem('pokechef-art-style') || 'pixel'; } catch {}
    if (!['pixel', 'artwork', 'off'].includes(style)) style = 'pixel';
    let ids = [];

    function shuffle() {
        // Sample without replacement; the base sprites cover the full national dex.
        const pool = Array.from({length: 1025}, (_, i) => i + 1);
        ids = [];
        for (let i = 0; i < 36; i++) {
            ids.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        }
        render();
    }

    function render() {
        app.dataset.artStyle = style;
        selector.value = style;
        background.replaceChildren();
        document.getElementById('shuffle-background').disabled = style === 'off';
        if (style !== 'off') {
            ids.forEach((id, index) => {
                const image = document.createElement('img');
                image.alt = '';
                image.draggable = false;
                image.decoding = 'async';
                image.src = spriteBase + (style === 'artwork' ? 'other/official-artwork/' : '') + id + '.png';
                image.style.left = `${(index % 6) * 18 - 4 + Math.random() * 5}%`;
                image.style.top = `${Math.floor(index / 6) * 17 + Math.random() * 2}%`;
                image.style.transform = `rotate(${Math.random() * 24 - 12}deg)`;
                image.addEventListener('error', () => image.remove(), {once: true});
                background.appendChild(image);
            });
        }
        // Team image lookup is cached; switching styles does not call the AI.
        document.dispatchEvent(new CustomEvent('pokechef:art-style', {detail: style}));
    }

    selector.addEventListener('change', () => {
        style = selector.value;
        try { localStorage.setItem('pokechef-art-style', style); } catch {}
        render();
    });
    document.getElementById('shuffle-background').addEventListener('click', shuffle);
    document.querySelectorAll('.about-trigger').forEach(button => button.addEventListener('click', () => {
        settings.close();
        about.showModal();
    }));
    about.addEventListener('click', event => {
        if (event.target !== about) return;
        const bounds = about.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) about.close();
    });
    about.addEventListener('close', () => {
        try { localStorage.setItem('pokechef-about-seen', '1'); } catch {}
    });
    try { if (!localStorage.getItem('pokechef-about-seen')) about.showModal(); } catch {}

    function review() {
        document.dispatchEvent(new Event('pokechef:import'));
    }
    document.querySelector('.sidebar-review').addEventListener('click', () => document.querySelector('[data-tab="review"]').click());
    document.getElementById('import-shortcut').addEventListener('click', review);
    document.getElementById('matchup-shortcut').addEventListener('click', () => {
        const input = document.getElementById('message-input');
        input.value = 'Help me check type weaknesses and resistances for ';
        input.focus();
    });
    const menu = document.getElementById('sidebar-toggle');
    function closeSidebar() { document.body.classList.remove('sidebar-open'); menu.setAttribute('aria-expanded', 'false'); }
    menu.addEventListener('click', () => {
        const open = document.body.classList.toggle('sidebar-open');
        menu.setAttribute('aria-expanded', String(open));
    });
    document.querySelector('.app').addEventListener('click', closeSidebar);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeSidebar(); });
    document.querySelectorAll('.sidebar-review, #new-chat, #chat-list').forEach(element => element.addEventListener('click', closeSidebar));
    document.querySelector('.sidebar-brand').addEventListener('click', event => {
        event.preventDefault();
        document.getElementById('new-chat').click();
        closeSidebar();
    });
    shuffle();
})();
