
// --------------------
// Elements
// --------------------

const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
const settingsDialog = document.getElementById("settings-dialog");
const importPage = document.getElementById("import-page");
const importError = document.getElementById("import-error");

function openTeamImport() {
    showPage('review');
    if (previewedTeamText) teamInput.value = previewedTeamText;
    importError.classList.add('hidden');
    importPage.classList.remove('hidden');
    reviewResults.classList.add('hidden');
    document.getElementById('cancel-import').classList.toggle('hidden', !previewedTeamText);
    teamInput.focus();
}
function showPage(page, updateHistory = true) {
    const isReview = page === 'review';
    document.getElementById('chat-panel').classList.toggle('active', !isReview);
    document.getElementById('review-panel').classList.toggle('active', isReview);
    document.querySelector('.sidebar-review').setAttribute('aria-current', isReview ? 'page' : 'false');
    updateChatSelection();
    if (updateHistory) {
        const hash = isReview ? '#review' : '#chat';
        if (location.hash !== hash) history.pushState(null, '', hash);
    }
    window.scrollTo({top: 0, behavior: 'instant'});
}
function openReviewPage() {
    if (previewedTeamText) {
        showPage('review');
        importPage.classList.add('hidden');
        reviewResults.classList.remove('hidden');
    } else openTeamImport();
}
function scrollToTeam() {
    const title = document.getElementById('imported-team-title');
    showPage('review');
    importPage.classList.add('hidden');
    reviewResults.classList.remove('hidden');
    requestAnimationFrame(() => {
        title.focus({preventScroll: true});
        reviewResults.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start'});
    });
}
document.addEventListener('pokechef:import', openTeamImport);
document.getElementById('edit-import').addEventListener('click', openTeamImport);
document.getElementById('cancel-import').addEventListener('click', openReviewPage);
document.getElementById('back-to-chat').addEventListener('click', () => showPage('chat'));
window.addEventListener('popstate', () => {
    if (location.hash === '#review') openReviewPage(); else showPage('chat', false);
});
document.getElementById("settings-button").addEventListener("click", () => settingsDialog.showModal());
settingsDialog.addEventListener("click", event => {
    if (event.target !== settingsDialog) return;
    const bounds = settingsDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) settingsDialog.close();
});

const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const messages = document.getElementById("messages");
const sendButton = document.getElementById("send-button");

const reviewForm = document.getElementById("review-form");
const teamInput = document.getElementById("team-input");
const reviewButton = document.getElementById("review-button");
const exampleButton = document.getElementById("example-button");

const reviewResults = document.getElementById("review-results");
const teamMembers = document.getElementById("team-members");
const reviewAnswer = document.getElementById("review-answer");

const followupForm = document.getElementById("followup-form");
const followupInput = document.getElementById("followup-input");
const followupButton = document.getElementById("followup-button");
const followupMessages = document.getElementById("followup-messages");

// Preserve the exact imported team for follow-ups.
let reviewedTeamText = null;
let previewedTeamText = null;
let importVersion = 0;
const previewButton = document.getElementById("preview-button");

function invalidateImport() {
    importVersion += 1;
    previewedTeamText = null;
    reviewedTeamText = null;
    reviewButton.disabled = true;
    reviewResults.classList.add("hidden");
    followupForm.classList.add("hidden");
}
teamInput.addEventListener('input', () => importError.classList.add('hidden'));


// --------------------
// Shared helpers
// --------------------

async function postJSON(url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('AI requests need the PokéChef backend. Start the FastAPI server and open its URL; a static preview only supports importing teams.');
    }
    const data = await response.json();

    if (!response.ok) {
        const message = typeof data.detail === "string"
            ? data.detail
            : `Server error: HTTP ${response.status}`;

        throw new Error(message);
    }

    return data;
}


function addMessage(container, text, role) {
    const element = document.createElement("div");

    element.className = `message ${role}`;
    element.textContent = text;

    container.appendChild(element);

    return element;
}


// --------------------
// Tab switching
// --------------------

tabs.forEach(tab => {
    tab.addEventListener("click", () => {
        if (tab.dataset.tab === 'review') {
            openReviewPage();
        } else {
            showPage('chat');
        }
    });
});


// --------------------
// AI Chat
// --------------------

let browserStorage;
try { browserStorage = window.localStorage; } catch { browserStorage = null; }
const chatStore = new ChatStore(browserStorage);
const pendingChats = new Set();
const chatList = document.getElementById("chat-list");
const renameDialog = document.getElementById('rename-chat-dialog');
const deleteDialog = document.getElementById('delete-chat-dialog');
const chatNameInput = document.getElementById('chat-name-input');
let managedChatId = null;

document.querySelectorAll('[data-close-chat-dialog]').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog').close());
});
for (const dialog of [renameDialog, deleteDialog]) {
    dialog.addEventListener('close', () => { managedChatId = null; });
}
chatNameInput.addEventListener('input', () => chatNameInput.setCustomValidity(''));
document.getElementById('rename-chat-form').addEventListener('submit', event => {
    event.preventDefault();
    const title = chatNameInput.value.trim();
    if (!title) {
        chatNameInput.setCustomValidity('Enter a chat name.');
        chatNameInput.reportValidity();
        return;
    }
    const id = managedChatId;
    chatStore.rename(id, title);
    renameDialog.close();
    renderChats();
    focusChat(id);
});
document.getElementById('delete-chat-form').addEventListener('submit', event => {
    event.preventDefault();
    chatStore.remove(managedChatId);
    deleteDialog.close();
    renderChats();
    focusChat(chatStore.activeId);
});
function focusChat(id) {
    Array.from(chatList.querySelectorAll('.chat-select')).find(button => button.dataset.chatId === id)?.focus({preventScroll: true});
}
function scrollToLatest() {
    if (!document.getElementById('chat-panel').classList.contains('active')) return;
    requestAnimationFrame(() => chatForm.scrollIntoView({block: 'end', behavior: 'instant'}));
}

function renderChats() {
    chatList.replaceChildren();
    for (const chat of chatStore.chats) {
        const row = document.createElement("div");
        const isSelected = chat.id === chatStore.activeId && document.getElementById('chat-panel').classList.contains('active');
        row.className = `chat-row${isSelected ? " selected" : ""}`;
        const select = document.createElement("button");
        select.className = "chat-select";
        select.dataset.chatId = chat.id;
        select.textContent = chat.title;
        select.title = chat.title;
        select.setAttribute("aria-current", String(isSelected));
        select.addEventListener("click", () => {
            chatStore.select(chat.id);
            document.querySelector('[data-tab="chat"]').click();
            renderChats();
        });
        const rename = document.createElement("button");
        rename.className = "chat-action";
        rename.textContent = "✎";
        rename.setAttribute("aria-label", `Rename ${chat.title}`);
        rename.addEventListener("click", () => {
            managedChatId = chat.id;
            chatNameInput.value = chat.title;
            chatNameInput.setCustomValidity('');
            renameDialog.showModal();
            chatNameInput.focus();
            chatNameInput.select();
        });
        const remove = document.createElement("button");
        remove.className = "chat-action";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Delete ${chat.title}`);
        remove.addEventListener("click", () => {
            managedChatId = chat.id;
            document.getElementById('delete-chat-name').textContent = chat.title;
            deleteDialog.showModal();
        });
        row.append(select, rename, remove);
        chatList.appendChild(row);
    }
    document.getElementById("storage-notice").textContent = chatStore.persisted
        ? "Chats are saved in this browser."
        : "Browser storage unavailable or full. Changes are only kept until you leave this page.";
    messages.replaceChildren();
    const active = chatStore.active();
    if (!active.messages.length) {
        const welcome = document.getElementById("chat-welcome-template").content.cloneNode(true);
        welcome.querySelector('[data-action="review"]').addEventListener("click", () => {
            document.querySelector('[data-tab="review"]').click();
            teamInput.focus();
        });
        welcome.querySelectorAll("[data-prompt]").forEach(button => {
            button.addEventListener("click", () => {
                messageInput.value = button.dataset.prompt;
                messageInput.focus();
            });
        });
        messages.appendChild(welcome);
    }
    for (const message of active.messages) addMessage(messages, message.content, message.role);
    if (pendingChats.has(active.id)) addMessage(messages, "PokéChef is cooking...", "assistant");
    sendButton.disabled = pendingChats.has(active.id);
    messages.setAttribute("aria-busy", String(pendingChats.has(active.id)));
}

function updateChatSelection() {
    const inChat = document.getElementById('chat-panel').classList.contains('active');
    document.querySelectorAll('.chat-row').forEach(row => {
        const button = row.querySelector('.chat-select');
        const selected = inChat && button.dataset.chatId === chatStore.activeId;
        row.classList.toggle('selected', selected);
        button.setAttribute('aria-current', String(selected));
    });
}

function openNewChat() {
    // Reuse an empty draft rather than filling the sidebar with empty chats.
    const draft = chatStore.chats.find(chat => !chat.messages.length);
    if (draft) chatStore.select(draft.id); else chatStore.create();
    document.querySelector('[data-tab="chat"]').click();
    messageInput.value = "";
    renderChats();
    messageInput.focus({preventScroll: true});
    window.scrollTo({top: 0, behavior: 'instant'});
}
document.getElementById("new-chat").addEventListener("click", openNewChat);
document.getElementById("home-link").addEventListener("click", event => {
    event.preventDefault();
    openNewChat();
});
renderChats();
if (location.hash === '#review') openTeamImport();

chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const question = messageInput.value.trim();
    const chat = chatStore.active();
    if (!question || pendingChats.has(chat.id)) return;
    const history = chatStore.context(chat);
    if (!chat.messages.length && chat.title === "New chat") chat.title = question.slice(0, 60);
    chat.messages.push({ role: "user", content: question });
    chatStore.save();
    pendingChats.add(chat.id);

    messageInput.value = "";
    renderChats();
    scrollToLatest();

    try {
        const data = await postJSON("/api/chat", {
            message: question,
            history
        });

        chat.messages.push({ role: "assistant", content: data.answer });

    } catch (error) {
        chat.messages.push({ role: "assistant", content: `Error: ${error.message}`, error: true });

    } finally {
        pendingChats.delete(chat.id);
        // A response belongs to its originating chat, even after switching/deleting.
        chatStore.save();
        renderChats();
        if (chatStore.activeId === chat.id && document.getElementById('chat-panel').classList.contains('active')) {
            messageInput.focus({preventScroll: true});
            scrollToLatest();
        }
    }
});


// --------------------
// Example Showdown team
// --------------------

const exampleTeam = `Dragonite @ Heavy-Duty Boots
Ability: Multiscale
Tera Type: Normal
EVs: 252 Atk / 4 SpD / 252 Spe
Adamant Nature
- Dragon Dance
- Extreme Speed
- Earthquake
- Roost

Heatran @ Leftovers
Ability: Flash Fire
Tera Type: Grass
EVs: 252 HP / 4 SpA / 252 SpD
Calm Nature
- Magma Storm
- Earth Power
- Stealth Rock
- Taunt

Corviknight @ Rocky Helmet
Ability: Pressure
EVs: 252 HP / 252 Def / 4 SpD
Impish Nature
- Roost
- Defog
- Body Press
- U-turn`;


exampleButton.addEventListener("click", () => {
    teamInput.value = exampleTeam;
    importError.classList.add('hidden');
});


// --------------------
// Show imported team
// --------------------

// Cache promises so rerendering a team never repeats a successful image lookup.
const pokemonImageCache = new Map();
function pokemonImage(species) {
    const name = species.trim().toLowerCase().replaceAll(" ", "-");
    if (!pokemonImageCache.has(name)) {
        const request = fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name)}`, {
            signal: AbortSignal.timeout(8000)
        }).then(response => {
            if (!response.ok) throw new Error("Image lookup failed");
            return response.json();
        }).then(data => ({
            types: data.types.map(entry => entry.type.name),
            pixel: data.sprites?.front_default || null,
            artwork: data.sprites?.other?.["official-artwork"]?.front_default || data.sprites?.front_default || null
        })).catch(() => {
            pokemonImageCache.delete(name);
            return null;
        });
        pokemonImageCache.set(name, request);
    }
    return pokemonImageCache.get(name);
}

const moveTypeCache = new Map();
const cardLineObserver = new ResizeObserver(entries => {
    for (const {target} of entries) {
        target.querySelectorAll('.member-single-line').forEach(line => {
            line.style.fontSize = '13px';
            if (line.scrollWidth > line.clientWidth && line.clientWidth > 0) {
                line.style.fontSize = `${13 * line.clientWidth / line.scrollWidth}px`;
            }
        });
    }
});
const pokemonTypes = new Set(['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy']);
function typeBadge(type) {
    const badge = document.createElement('span');
    badge.className = `type-badge type-${type}`;
    badge.textContent = type;
    return badge;
}
function moveType(name) {
    const slug = name.trim().toLowerCase().replaceAll(' ', '-');
    if (!moveTypeCache.has(slug)) {
        const request = fetch(`https://pokeapi.co/api/v2/move/${encodeURIComponent(slug)}`, {signal: AbortSignal.timeout(8000)})
            .then(response => { if (!response.ok) throw new Error('Move lookup failed'); return response.json(); })
            .then(data => pokemonTypes.has(data.type?.name) ? data.type.name : null)
            .catch(() => { moveTypeCache.delete(slug); return null; });
        moveTypeCache.set(slug, request);
    }
    return moveTypeCache.get(slug);
}
function updateCardArtwork(card) {
    const species = card.dataset.species;
    const artwork = card.querySelector('.member-artwork');
    pokemonImage(species).then(images => {
        if (!card.isConnected) return;
        const types = card.querySelector('.card-types');
        types.replaceChildren();
        if (images?.types?.length) {
            images.types.filter(type => pokemonTypes.has(type)).forEach(type => types.appendChild(typeBadge(type)));
        } else {
            types.textContent = 'Types unavailable';
        }
        const style = document.querySelector('.app').dataset.artStyle;
        const url = images && (style === 'pixel' ? images.pixel : images.artwork);
        if (!url) { artwork.textContent = 'Image unavailable'; return; }
        const image = document.createElement('img');
        image.alt = species;
        image.width = 128;
        image.height = 128;
        image.loading = 'lazy';
        image.src = url;
        image.addEventListener('error', () => { artwork.textContent = 'Image unavailable'; }, {once: true});
        artwork.replaceChildren(image);
    });
}

function renderTeam(team) {
    const statLabels = {hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe'};
    const natureEffects = {
        lonely: ['Atk', 'Def'], brave: ['Atk', 'Spe'], adamant: ['Atk', 'SpA'], naughty: ['Atk', 'SpD'],
        bold: ['Def', 'Atk'], relaxed: ['Def', 'Spe'], impish: ['Def', 'SpA'], lax: ['Def', 'SpD'],
        timid: ['Spe', 'Atk'], hasty: ['Spe', 'Def'], jolly: ['Spe', 'SpA'], naive: ['Spe', 'SpD'],
        modest: ['SpA', 'Atk'], mild: ['SpA', 'Def'], quiet: ['SpA', 'Spe'], rash: ['SpA', 'SpD'],
        calm: ['SpD', 'Atk'], gentle: ['SpD', 'Def'], sassy: ['SpD', 'Spe'], careful: ['SpD', 'SpA']
    };
    const spread = values => Object.entries(values).map(([stat, value]) => `${value} ${statLabels[stat] || stat}`).join(' / ');
    teamMembers.querySelectorAll('.member-card').forEach(card => cardLineObserver.unobserve(card));
    teamMembers.replaceChildren();
    for (const pokemon of team) {
        const card = document.createElement('article');
        card.className = 'member-card';
        card.dataset.species = pokemon.species;
        const visual = document.createElement('div');
        visual.className = 'member-visual';
        const artwork = document.createElement('div');
        artwork.className = 'member-artwork';
        artwork.textContent = 'Loading image…';
        visual.appendChild(artwork);
        if (pokemon.item) {
            const icon = document.createElement('img');
            icon.className = 'member-item-icon';
            icon.alt = '';
            icon.width = 30;
            icon.height = 30;
            icon.src = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/${encodeURIComponent(pokemon.item.toLowerCase().replaceAll(' ', '-'))}.png`;
            icon.addEventListener('error', () => icon.remove(), {once: true});
            visual.appendChild(icon);
        }
        const body = document.createElement('div');
        body.className = 'member-set';
        const title = document.createElement('h4');
        const species = document.createElement('span');
        species.className = 'member-species';
        species.textContent = pokemon.species;
        title.append(species);
        body.appendChild(title);
        const types = document.createElement('div');
        types.className = 'card-types';
        types.setAttribute('aria-label', `${pokemon.species} types`);
        types.textContent = 'Loading types…';
        body.appendChild(types);
        let fieldTarget = body;
        function field(label, value, className) {
            const line = document.createElement('p');
            const name = document.createElement('span');
            name.className = 'set-label';
            name.textContent = `${label}: `;
            const content = document.createElement('span');
            content.textContent = value;
            if (className) content.className = className;
            line.append(name, content);
            fieldTarget.appendChild(line);
            return content;
        }
        if (pokemon.nickname) field('Nickname', pokemon.nickname);
        field('Item', pokemon.item || 'None');
        field('Ability', pokemon.ability || 'Unspecified');
        if (pokemon.gender) field('Gender', pokemon.gender);
        if (pokemon.tera_type) {
            const tera = field('Tera Type', pokemon.tera_type, 'set-tera');
            const type = pokemon.tera_type.toLowerCase();
            if (pokemonTypes.has(type)) tera.replaceChildren(typeBadge(type));
        }
        const stats = document.createElement('div');
        stats.className = 'member-stats';
        fieldTarget = stats;
        const nature = document.createElement('p');
        nature.className = 'member-single-line member-nature';
        const natureLabel = document.createElement('span');
        natureLabel.className = 'set-label';
        natureLabel.textContent = 'Nature: ';
        nature.append(natureLabel, document.createTextNode(pokemon.nature || 'Unspecified'));
        const effect = natureEffects[pokemon.nature?.toLowerCase()];
        if (effect) {
            for (const [index, stat] of effect.entries()) {
                const value = document.createElement('span');
                value.className = index === 0 ? 'nature-boost' : 'nature-drop';
                value.textContent = ` ${index === 0 ? '+' : '−'}${stat}`;
                nature.appendChild(value);
            }
        }
        stats.appendChild(nature);
        field('EVs', spread(pokemon.evs) || 'Unspecified').parentElement.classList.add('member-single-line', 'member-evs');
        if (Object.keys(pokemon.ivs).length) field('IVs', spread(pokemon.ivs));
        if (pokemon.level !== 100) field('Level', String(pokemon.level));
        const moves = document.createElement('ul');
        moves.className = 'member-moves';
        for (const move of pokemon.moves) {
            const line = document.createElement('li');
            const moveName = document.createElement('span');
            moveName.textContent = move;
            const badgeSlot = document.createElement('span');
            badgeSlot.className = 'move-type-slot';
            badgeSlot.textContent = '…';
            badgeSlot.setAttribute('aria-label', `${move} type loading`);
            line.append(moveName, badgeSlot);
            moves.appendChild(line);
            moveType(move).then(type => {
                if (!line.isConnected) return;
                badgeSlot.replaceChildren();
                badgeSlot.setAttribute('aria-label', `${move} type`);
                if (type) badgeSlot.appendChild(typeBadge(type));
                else badgeSlot.textContent = 'Type unavailable';
            });
        }
        stats.appendChild(moves);
        card.append(visual, body, stats);
        teamMembers.appendChild(card);
        cardLineObserver.observe(card);
        updateCardArtwork(card);
    }
}

document.addEventListener('pokechef:art-style', () => {
    document.querySelectorAll('.member-card').forEach(updateCardArtwork);
});


// --------------------
// Team Review
// --------------------

reviewForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const teamText = teamInput.value.trim();
    if (!teamText || previewButton.disabled) return;
    const data = ShowdownImport.parse(teamText);
    if (data.error) {
        importError.textContent = data.error;
        importError.classList.remove('hidden');
        return;
    }
    invalidateImport();
    reviewResults.classList.remove("hidden");
    teamMembers.replaceChildren();
    document.getElementById("import-warnings").replaceChildren();
    document.getElementById("import-note").textContent = "";
    reviewAnswer.textContent = "";
    followupMessages.replaceChildren();
        renderTeam(data.team);
        document.getElementById('team-count').textContent = `${data.count} Pokémon imported · ready to review`;
        document.getElementById('warning-count').textContent = data.warnings.length ? `(${data.warnings.length} warnings)` : '';
        document.getElementById("import-note").textContent = data.note;
        for (const warning of data.warnings) {
            const line = document.createElement("li");
            line.textContent = warning;
            document.getElementById("import-warnings").appendChild(line);
        }
        previewedTeamText = teamText;
        reviewButton.disabled = false;
        followupForm.classList.remove('hidden');
        document.getElementById('ai-review-section').classList.add('hidden');
        scrollToTeam();
});

reviewButton.addEventListener("click", async () => {

    const teamText = previewedTeamText;
    if (!teamText || reviewButton.disabled) return;
    const version = importVersion;

    reviewedTeamText = null;
    reviewButton.disabled = true;
    reviewButton.textContent = "Reviewing...";

    reviewResults.classList.remove("hidden");

    reviewAnswer.textContent = "PokéChef is reviewing your team...";
    document.getElementById('ai-review-section').classList.remove('hidden');

    try {
        const data = await postJSON("/api/team/review", {
            team_text: teamText
        });
        if (version !== importVersion) return;

        reviewedTeamText = teamText;

        renderTeam(data.team);
        reviewAnswer.textContent = data.review;

        followupForm.classList.remove("hidden");

    } catch (error) {
        if (version === importVersion) reviewAnswer.textContent = `Error: ${error.message}`;

    } finally {
        reviewButton.disabled = !previewedTeamText;
        reviewButton.textContent = "Review Team with AI";
    }
});


// --------------------
// Team Follow-up
// --------------------

followupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const question = followupInput.value.trim();
    const teamText = previewedTeamText;

    if (!question || !teamText || followupButton.disabled) return;
    const version = importVersion;

    addMessage(followupMessages, question, "user");

    followupInput.value = "";
    followupButton.disabled = true;

    const pending = addMessage(
        followupMessages,
        "PokéChef is thinking...",
        "assistant"
    );

    try {
        const data = await postJSON("/api/team/followup", {
            team_text: teamText,
            question: question
        });

        if (version === importVersion) pending.textContent = data.answer;

    } catch (error) {
        pending.textContent = `Error: ${error.message}`;

    } finally {
        followupButton.disabled = false;
        followupInput.focus();
    }
});
