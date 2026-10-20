const { test } = require('node:test');
const assert = require('node:assert/strict');
const ChatStore = require('../static/chat-store.js');
function storage() {
    let value = null;
    return { getItem: () => value, setItem: (_, next) => { value = next; } };
}
test('create, switch, rename, reload and delete chats', () => {
    const disk = storage();
    const store = new ChatStore(disk);
    const first = store.active();
    first.messages.push({ role: 'user', content: 'Dragonite' });
    const second = store.create();
    store.rename(first.id, 'Dragonite team');
    store.select(first.id);
    const restored = new ChatStore(disk);
    assert.equal(restored.active().title, 'Dragonite team');
    assert.equal(restored.active().messages[0].content, 'Dragonite');
    restored.remove(first.id);
    assert.equal(restored.activeId, second.id);
    restored.remove(second.id);
    assert.equal(restored.chats.length, 1);
});
test('context excludes errors and respects both bounds', () => {
    const store = new ChatStore(storage());
    const chat = store.active();
    chat.messages = Array.from({length: 20}, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: String(i) }));
    chat.messages.push({role:'assistant',content:'failure',error:true});
    assert.equal(store.context(chat).length, 12);
    assert.equal(store.context(chat)[0].content, '8');
    chat.messages = [{role:'user',content:'x'.repeat(7000)}, {role:'assistant',content:'y'.repeat(7000)}];
    assert.equal(store.context(chat).length, 1);
});
test('corrupt or unavailable storage leaves chat usable', () => {
    const corrupt = new ChatStore({getItem: () => '{', setItem: () => {throw Error('full');}});
    assert.ok(corrupt.active());
    assert.equal(corrupt.persisted, false);
    assert.ok(new ChatStore(null).active());
});
