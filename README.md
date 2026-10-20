# PokeChef
Your AI-powered competitive Pokémon sous-chef. An agentic Pokémon assistant that looks up Pokémon, analyzes competitive teams, builds strategies, and helps players refine their teams using real game data and specialized tools.

The chat workspace includes a random Pokémon background. Open **Settings** to
choose pixel art (default), official artwork, or no background, or shuffle the
Pokémon. Your art preference is stored in this browser and also applies to imported
team images. Sprites and artwork are loaded from PokéAPI's sprite repository via
jsDelivr; unavailable images are hidden. The original sun/moon appearance slider
switches light and dark mode. The About popup appears on the first visit and can
be reopened from the header or Settings.

Chat history is saved in localStorage in the current browser, without accounts or a
database. Use the sidebar to create, switch, rename, or delete chats. Clearing site
data removes saved chats. If storage is unavailable or full, a notice explains that
changes will only last for the current page session. Avoid editing chats in multiple
tabs simultaneously; each tab saves its own snapshot.

Long conversations scroll with the page, rather than inside a transcript panel.
Both PokéChef logos return to a new chat. Rename and delete actions open themed
dialogs, with cancellation and explicit save/delete buttons.

Only the selected chat's latest 12 prior messages (at most 12,000 characters) are
sent with a question. Older messages remain visible locally but are outside the
model's context. Failed responses are excluded. Renaming and switching chats do
not call OpenAI. The existing three-model-request limit still applies per question.

Offline regression checks (no API calls):

Team Review has its own `#review` page view, separate from chat. **Import team**
opens the import form on that page and parses pasted Showdown text locally,
without a backend or AI call. The page then scrolls to your imported
sets. Inspect the cards and import notes, then click **Review Team with AI** to
request the paid review. **Edit import** lets you replace the team; cancelling
preserves the existing import. Import validates basic structure and stat ranges;
it does not verify species names, move names, or competitive format legality.
Gender is accepted either in the Pokémon header, such as `(F)`, or as a separate
`Gender: F`, `Gender: M`, or `Gender: N` line. Conflicting/duplicate declarations
are rejected. Imported sets show sprite and item images alongside the full set,
in three columns and two rows for a six-member team on desktop.
Cards use the app font with Item and Nature labels. EV and Nature lines use the
full card width and fit without wrapping or shortening their text. Pokémon, Tera,
and move type badges reuse CompDex's badge styles and palette, using cached
PokéAPI lookups for species and moves. The team chat is available immediately
after import and stays open when requesting a full review; a full review is not
required before asking a team question. Team Review clears the sidebar's active
chat highlight, which returns when navigating back to chat.
If a type lookup fails, it is shown as unavailable rather than guessed.
AI chat and reviews still require the FastAPI server and an API key; Live Server
can display the frontend and import teams but cannot answer AI requests.

```powershell
.\.venv\Scripts\python.exe -B -m unittest discover -s tests
node --test tests/chat-store.test.cjs
node --test tests/showdown-import.test.cjs
```

Optional frontend smoke check (requires Playwright and installed Google Chrome):
`node tests/ui-smoke.cjs`. This starts its own local static server, checks desktop
and mobile layouts and preferences, mocks chat and move-type responses, and tests
the real local import parser, review-page navigation, and badge rendering without
an import API. It loads
public sprite images but makes no paid AI calls. Screenshots go to the system temp
directory, or `POKECHEF_SCREENSHOT_DIR` when set.
