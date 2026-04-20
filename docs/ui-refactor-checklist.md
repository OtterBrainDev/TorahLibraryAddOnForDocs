# UI Refactor Checklist

## Global setup
- [ ] Add ui_core.gs
- [ ] Add ui_pages.gs if needed
- [ ] Add ui_head.html
- [ ] Add ui_shell.css.html
- [ ] Add ui_components.css.html
- [ ] Add ui_utilities.css.html
- [ ] Add ui_core.js.html
- [ ] Add ui_api.js.html
- [ ] Add ui_state.js.html
- [ ] Add ui_dom.js.html
- [ ] Add ui_feedback.js.html

## Rules for each page
For each page below, do these in order:

1. Introduce shared includes without deleting existing page CSS/JS.
2. Verify page still renders and event handlers still bind.
3. Extract only obviously duplicated CSS to shared files.
4. Verify again.
5. Extract only obviously duplicated JS helpers to shared files.
6. Verify again.
7. Rename page JS to `*.page.js.html` only after behavior is confirmed.
8. Remove now-unused duplicated code only after verification.

## Pages
### Sidebar
- [ ] ui_head included
- [ ] APP_CONFIG added
- [ ] shared JS loaded
- [ ] sidebar page module isolated
- [ ] old behavior preserved

### Preferences
- [ ] ui_head included
- [ ] APP_CONFIG added
- [ ] shared JS loaded
- [ ] preferences page module isolated
- [ ] old behavior preserved

### AI lesson
- [ ] ui_head included
- [ ] APP_CONFIG added
- [ ] shared JS loaded
- [ ] ai lesson page module isolated
- [ ] old behavior preserved

### Surprise me
- [ ] ui_head included
- [ ] APP_CONFIG added
- [ ] shared JS loaded
- [ ] surprise me page module isolated
- [ ] old behavior preserved

## Stop conditions
Stop and do not continue extraction if:
- a selector must be renamed
- layout shifts
- page-specific behavior becomes harder to express
- a shared helper requires hidden behavior changes
