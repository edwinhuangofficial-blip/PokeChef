
// --------------------
// Elements
// --------------------

const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
const settingsDialog = document.getElementById("settings-dialog");
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
teamInput.addEventListener("input", invalidateImport);


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
    container.scrollTop = container.scrollHeight;

    return element;
}


// --------------------
// Tab switching
// --------------------

tabs.forEach(tab => {
    tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        panels.forEach(p => p.classList.remove("active"));

        tab.classList.add("active");

        const panel = document.getElementById(
            `${tab.dataset.tab}-panel`
        );

        panel.classList.add("active");
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

function renderChats() {
    chatList.replaceChildren();
    for (const chat of chatStore.chats) {
        const row = document.createElement("div");
        row.className = `chat-row${chat.id === chatStore.activeId ? " selected" : ""}`;
        const select = document.createElement("button");
        select.className = "chat-select";
        select.textContent = chat.title;
        select.title = chat.title;
        select.setAttribute("aria-current", String(chat.id === chatStore.activeId));
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
            const title = window.prompt("Chat name", chat.title);
            if (title !== null) chatStore.rename(chat.id, title);
            renderChats();
        });
        const remove = document.createElement("button");
        remove.className = "chat-action";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Delete ${chat.title}`);
        remove.addEventListener("click", () => {
            if (!window.confirm(`Delete “${chat.title}”?`)) return;
            chatStore.remove(chat.id);
            renderChats();
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

function openNewChat() {
    // Reuse an empty draft rather than filling the sidebar with empty chats.
    const draft = chatStore.chats.find(chat => !chat.messages.length);
    if (draft) chatStore.select(draft.id); else chatStore.create();
    document.querySelector('[data-tab="chat"]').click();
    messageInput.value = "";
    renderChats();
    messageInput.focus();
}
document.getElementById("new-chat").addEventListener("click", openNewChat);
document.getElementById("home-link").addEventListener("click", event => {
    event.preventDefault();
    openNewChat();
});
renderChats();

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
        if (chatStore.activeId === chat.id) messageInput.focus();
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
    invalidateImport();
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
        }).then(data => data.sprites?.other?.["official-artwork"]?.front_default ||
            data.sprites?.front_default || null).catch(() => {
            pokemonImageCache.delete(name);
            return null;
        });
        pokemonImageCache.set(name, request);
    }
    return pokemonImageCache.get(name);
}

function renderTeam(team) {
    teamMembers.replaceChildren();

    for (const pokemon of team) {
        const card = document.createElement("div");
        card.className = "member-card";
        const artwork = document.createElement("div");
        artwork.className = "member-artwork";
        artwork.textContent = "Loading image…";
        card.appendChild(artwork);
        pokemonImage(pokemon.species).then(url => {
            if (!url) { artwork.textContent = "Image unavailable"; return; }
            const image = document.createElement("img");
            image.alt = pokemon.species;
            image.width = 112;
            image.height = 112;
            image.loading = "lazy";
            image.addEventListener("error", () => { artwork.textContent = "Image unavailable"; }, {once: true});
            image.src = url;
            artwork.replaceChildren(image);
        });

        const title = document.createElement("h4");
        title.textContent = pokemon.species;

        const item = document.createElement("p");
        item.textContent = `Item: ${pokemon.item || "None"}`;

        const ability = document.createElement("p");
        ability.textContent =
            `Ability: ${pokemon.ability || "Unspecified"}`;

        const moves = document.createElement("p");
        moves.textContent =
            `Moves: ${pokemon.moves.join(", ") || "None listed"}`;

        card.append(title, item, ability, moves);
        const fields = [
            ["Nickname", pokemon.nickname], ["Gender", pokemon.gender],
            ["Level", pokemon.level], ["Nature", pokemon.nature || "Unspecified"],
            ["Tera type", pokemon.tera_type || "Unspecified"],
            ["EVs", Object.entries(pokemon.evs).map(([stat, value]) => `${value} ${stat.toUpperCase()}`).join(" / ") || "Unspecified"],
            ["IVs", Object.entries(pokemon.ivs).map(([stat, value]) => `${value} ${stat.toUpperCase()}`).join(" / ") || "Default (31 per stat)"]
        ];
        for (const [label, value] of fields) {
            if (value === null) continue;
            const line = document.createElement("p");
            line.textContent = `${label}: ${value}`;
            card.appendChild(line);
        }
        teamMembers.appendChild(card);
    }
}


// --------------------
// Team Review
// --------------------

reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const teamText = teamInput.value.trim();
    if (!teamText || previewButton.disabled) return;
    invalidateImport();
    const version = importVersion;
    previewButton.disabled = true;
    previewButton.textContent = "Reading import...";
    reviewResults.classList.remove("hidden");
    teamMembers.replaceChildren();
    document.getElementById("import-warnings").replaceChildren();
    document.getElementById("import-note").textContent = "";
    reviewAnswer.textContent = "";
    followupMessages.replaceChildren();
    try {
        const data = await postJSON("/api/team/preview", {team_text: teamText});
        if (version !== importVersion) return;
        renderTeam(data.team);
        document.getElementById("import-note").textContent = `${data.count} Pokémon imported. ${data.note}`;
        for (const warning of data.warnings) {
            const line = document.createElement("li");
            line.textContent = warning;
            document.getElementById("import-warnings").appendChild(line);
        }
        previewedTeamText = teamText;
        reviewButton.disabled = false;
        reviewAnswer.textContent = "Check the imported sets above, then request an AI review when ready.";
    } catch (error) {
        if (version === importVersion) reviewAnswer.textContent = `Import error: ${error.message}`;
    } finally {
        previewButton.disabled = false;
        previewButton.textContent = "Preview import (free)";
    }
});

reviewButton.addEventListener("click", async () => {

    const teamText = teamInput.value.trim();
    if (!teamText || teamText !== previewedTeamText || reviewButton.disabled) return;
    const version = importVersion;

    reviewedTeamText = null;
    reviewButton.disabled = true;
    reviewButton.textContent = "Reviewing...";

    reviewResults.classList.remove("hidden");
    followupMessages.replaceChildren();
    followupForm.classList.add("hidden");

    reviewAnswer.textContent = "PokéChef is reviewing your team...";

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
        reviewButton.disabled = previewedTeamText !== teamInput.value.trim();
        reviewButton.textContent = "Review Team with AI";
    }
});


// --------------------
// Team Follow-up
// --------------------

followupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const question = followupInput.value.trim();

    if (!question || !reviewedTeamText) return;
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
            team_text: reviewedTeamText,
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
