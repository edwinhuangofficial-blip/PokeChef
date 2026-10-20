// Browser-only persistence. No server storage or model requests for chat management.
class ChatStore {
    constructor(storage) {
        this.storage = storage;
        this.chats = [];
        this.activeId = null;
        this.persisted = true;
        try {
            const saved = JSON.parse(storage.getItem("pokechef-chats-v1") || "null");
            if (saved && Array.isArray(saved.chats)) {
                this.chats = saved.chats.filter(chat => chat && typeof chat.id === "string" &&
                    typeof chat.title === "string" && Array.isArray(chat.messages)).map(chat => ({
                        id: chat.id, title: chat.title.slice(0, 80),
                        messages: chat.messages.filter(message => message &&
                            ["user", "assistant"].includes(message.role) &&
                            typeof message.content === "string" &&
                            message.content.length <= 20000).map(message => ({
                                role: message.role, content: message.content,
                                error: message.error === true
                            }))
                    }));
                this.activeId = saved.activeId;
            }
        } catch { this.persisted = false; }
        if (!this.active()) this.activeId = this.chats[0]?.id || null;
        if (!this.active()) this.create();
    }
    active() { return this.chats.find(chat => chat.id === this.activeId); }
    save() {
        try {
            this.storage.setItem("pokechef-chats-v1", JSON.stringify({
                chats: this.chats, activeId: this.activeId
            }));
            this.persisted = true;
        } catch { this.persisted = false; }
    }
    create() {
        const chat = { id: globalThis.crypto.randomUUID(), title: "New chat", messages: [] };
        this.chats.unshift(chat);
        this.activeId = chat.id;
        this.save();
        return chat;
    }
    select(id) {
        if (this.chats.some(chat => chat.id === id)) this.activeId = id;
        this.save();
    }
    rename(id, title) {
        const chat = this.chats.find(chat => chat.id === id);
        if (chat && title.trim()) chat.title = title.trim().slice(0, 80);
        this.save();
    }
    remove(id) {
        this.chats = this.chats.filter(chat => chat.id !== id);
        if (!this.active()) this.activeId = this.chats[0]?.id || null;
        if (!this.active()) this.create();
        this.save();
    }
    context(chat) {
        const result = [];
        let remaining = 12000;
        for (const message of chat.messages.filter(message => !message.error).slice(-12).reverse()) {
            if (message.content.length > remaining) break;
            result.unshift({ role: message.role, content: message.content });
            remaining -= message.content.length;
        }
        return result;
    }
}
if (typeof module !== "undefined") module.exports = ChatStore;
