# PokeChef
Your AI-powered competitive Pokémon sous-chef. An agentic Pokémon assistant that looks up Pokémon, analyzes competitive teams, builds strategies, and helps players refine their teams using real game data and specialized tools.

Chat history is saved in localStorage in the current browser, without accounts or a
database. Use the sidebar to create, switch, rename, or delete chats. Clearing site
data removes saved chats. If storage is unavailable or full, a notice explains that
changes will only last for the current page session. Avoid editing chats in multiple
tabs simultaneously; each tab saves its own snapshot.

Only the selected chat's latest 12 prior messages (at most 12,000 characters) are
sent with a question. Older messages remain visible locally but are outside the
model's context. Failed responses are excluded. Renaming and switching chats do
not call OpenAI. The existing three-model-request limit still applies per question.

Offline regression checks (no API calls):

Team Review uses two steps: **Preview import (free)** parses the pasted Showdown
text without network or AI calls. Inspect the sets and warnings, then click
**Review Team with AI** to request the paid review. Editing or loading another
import requires a fresh preview. Preview validates basic structure and stat ranges;
it does not verify species names, move names, or competitive format legality.

```powershell
.\.venv\Scripts\python.exe -B -m unittest discover -s tests
node --test tests/chat-store.test.cjs
```
