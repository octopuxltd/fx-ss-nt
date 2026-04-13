# Search defaults: what is stored where, and what the UI should show

This prototype splits **“which engine is the default for this access point”** (persisted strings in `localStorage`) from **“how the switcher list looks”** (order, grid/list, pinned row in the DOM) and from **“what the user last clicked in the switcher”** (chip icon / hero branding until a full resync). Bugs often come from updating one layer without the others.

---

## 1. Authoritative storage (`localStorage`)

All of the keys below are intended to live on the **top** document’s `localStorage` when the page is same-origin. Embedded **iframes** may have their **own** `localStorage` (especially opaque `file://` loads); the parent then **mirrors** values in via `postMessage` (see §4).

### 1.1 Default search engine (one label string per scope)

| Key | Meaning | Fallback when unset / empty |
| --- | --- | --- |
| `default_search_engine` | **Main / New Tab / Homepage** hero search | `'Google'` (in code paths that resolve the matrix) |
| `default_search_engine:addressbar` | **Address bar** iframe search | Falls back to **main** key |
| `default_search_engine:standalone` | **Standalone search box** iframe | Falls back to **main** key |

There is **no** `default_search_engine:private` key: private-window search in Search settings is always the same default as **New Tab / Homepage** (`default_search_engine`). Prototype reset still removes a legacy `default_search_engine:private` entry if present.

**Resolved helpers** (in `step1.js`):

- `getDefaultSearchEngineLabelFromStorage()` — picks the key for the **current document** (`getDefaultSearchEngineStorageKeyForPage()` uses `body.addressbar` / `body.standalone-search-box`), then falls back to `default_search_engine`, then `'Google'`.
- `getEffectiveSearchDefaultsFromStorage()` — returns `{ newTab, addressBar, standalone }` for the Search settings matrix and placeholder preview fields, applying the same fallbacks (and treating standalone as “off” when the standalone box is hidden). The **Private window** matrix row uses `newTab` for its placeholder preview engine.

### 1.2 Access-point behaviour (not an engine name)

| Key | Values | Affects |
| --- | --- | --- |
| `search_settings_navigate_new_tab` | `'true'` / other | “From Firefox” / navigate section in **main** switcher; placeholder shape for new-tab surface |
| `search_settings_navigate_private` | `'true'` / other | Placeholder preview for **private** row in Search settings |
| `search_settings_search_address_bar` | `'false'` or other | Address bar **Search off** (navigate-only) mode; placeholder and switcher chrome |

### 1.3 Visibility and layout (related to matrix, not engine id)

| Key | Role |
| --- | --- |
| `standalone_search_box_visible` | `'true'` / `'false'` — whether standalone engine key is active; matrix shows `__standalone_off__` when hidden |

### 1.4 Other persisted search UI (not the string “default engine”)

These affect **which engines appear** and **order / mode**, not the default label key above:

| Item | Notes |
| --- | --- |
| `search_engine_order` | Custom ordering of engines in the switcher |
| `search_engines_display:*` | Grid vs list (scoped, e.g. `search_engines_display:addressbar`, `:primary`, `:pinnedRight`) |
| `search_engines_count`, `twelve_search_engines_enabled` | Row count |
| `pin_default_search_engine_enabled` | Whether default row is pinned in the switcher |
| `firefox_suggestions_enabled` | Suggestion sources JSON |

### 1.5 Main hero wordmark (early HTML)

`step1.html` runs an early inline script that sets `document.body.dataset.mainScreenHeroEngineLabel` from **`localStorage.getItem('default_search_engine')` only** (not `default_search_engine:addressbar`). That is correct for the **main** page hero, but it is a **second read path** alongside JS that updates branding from the switcher (`syncMainScreenBrandFromSwitcherItem`, etc.). If JS does not run after a storage change, the dataset can lag.

---

## 2. Which UI must read or write “default engine” information

| Surface | Should show default | Storage key used (via JS) | Typical write path |
| --- | --- | --- | --- |
| **Main hero** — placeholder | Yes | `getDefaultSearchEngineLabelFromStorage()` → `default_search_engine` | Matrix on main page, hero switcher pin/drag, `setDefaultSearchEngineStorageItem(MAIN, …)` |
| **Main hero** — switcher chip, pinned row, wordmark | Yes (should match storage after sync) | Same label sources + DOM pin; full resync via `applySearchSwitcherUIFromStoredDefault()` | Same as above; **must** run after cross-surface storage updates or chip can disagree with placeholder |
| **Address bar iframe** | Yes | `default_search_engine:addressbar` (+ fallback to main) | Matrix column, address-only card in `search-settings.html`, switcher in iframe |
| **Standalone iframe** | Yes | `default_search_engine:standalone` (+ fallback) | Matrix, standalone visibility + engine select |
| **Search settings** (overlay `search-settings.html`) | Show + edit all columns | Reads/writes via `postMessage` to top: `set-default-search-engine` | Overlay does not own top `localStorage` until parent applies message |
| **Search settings** (embedded matrix in `step1` when used) | Same | Top `localStorage` | `syncSearchSettingsDefaultEngineSelects()` |
| **Private window** matrix row | Navigate checkbox only; engine **same as New Tab** | `default_search_engine` (via `newTab` in matrix) | Not separately editable |

---

## 3. Write API (single door for engine keys)

`setDefaultSearchEngineStorageItem(key, value)` in `step1.js`:

- On **`window === window.top`**: writes `localStorage`, then `broadcastSearchSettingsHtmlOverlayAfterTopEngineKeyWrite()` (push keys + `default-search-engine-changed` to overlay iframe).
- In a **child iframe**: `postMessage({ type: 'set-default-search-engine', key, value })` to parent; parent writes top storage and calls `syncTopDocumentSearchSurfacesAfterDefaultEngineKeysChanged(effBefore, key)`.

Invalid keys are ignored (only the three scoped `default_search_engine*` keys above).

---

## 4. Sync and `postMessage` map (where spaghetti tends to hide)

| Message / event | Direction | Effect |
| --- | --- | --- |
| `set-default-search-engine` | iframe → top | Parent writes key, runs `syncTopDocumentSearchSurfacesAfterDefaultEngineKeysChanged` (matrix, placeholders, `pushDefaultSearchEngineKeysToIframe`, `refresh-search-engine-switcher-from-storage` on address bar + standalone with **old** effective default for conditional switcher refresh) |
| `seed-default-search-engine-keys` | top → iframe | Iframe writes mirrored keys into **its** `localStorage`, then `applySearchSwitcherUIFromStoredDefault` + placeholder refresh |
| `mirror-default-search-engine` | top → iframe | Single key mirror + full switcher + placeholder refresh |
| `refresh-search-engine-switcher-from-storage` | top → iframe | `applySearchSwitcherAfterSearchSettingsChange(old)` or full `applySearchSwitcherUIFromStoredDefault()` |
| `refresh-search-access-point-placeholder` | top → iframe | Updates navigate/search flags in iframe storage from payload, then placeholder (+ address bar navigate-only chrome) |
| `default-search-engine-changed` | iframe → top | Lighter sync: matrix selects + placeholder previews + `broadcastSearchAccessPointPlaceholderRefresh` (**does not** push engine keys or refresh switcher DOM by itself) |
| `storage` (top) | — | `syncSearchSettingsDefaultEngineSelects` for keys including engine keys and engine count |

**Reading from the “right” place in JS:** `getDefaultSearchEngineLocalStorage()` returns **`window.top.localStorage`** when the iframe can reach `top` (same origin); otherwise the iframe’s own `localStorage` (stale until seed/mirror).

---

## 5. Intentional “two sources of truth” (easy to desync)

1. **Placeholder** — driven by `getDefaultSearchEngineLabelFromStorage()` + access-point flags (`buildAccessPointPlaceholderText`).
2. **Switcher chip / hero brand** — driven by **DOM** (last selected row, `.google-icon` alt, pinned row) until `applySearchSwitcherUIFromStoredDefault()` realigns from storage.
3. **Early `step1.html` dataset** — one-time read of `default_search_engine` for hero label hint.

If (1) updates from a top-level `broadcastSearchAccessPointPlaceholderRefresh` but (2) only runs `applySearchSwitcherPinnedDefaultOnly()` or skips refresh, you get **placeholder correct, branding wrong** (the bug that motivated tightening `applySearchSwitcherAfterSearchSettingsChange`).

---

## 6. `search-settings.html` vs embedded matrix

- **`search-settings.html`** (prototype overlay): duplicates key names and helpers; applies changes by posting `set-default-search-engine` to `parent`. It also listens for `seed-default-search-engine-keys` so its own `localStorage` matches top when `top` is not readable.
- **Embedded `<select>` matrix** in the main document: writes directly via `setDefaultSearchEngineStorageItem` then mirrors to iframes / refresh messages — same semantics, different code path.

When debugging “not saving”, check **whether the write went to top** (parent handler) or only to an **iframe’s** `localStorage`.

---

## 7. Quick audit checklist

- [ ] After changing **Firefox homepage** default, does **main** placeholder **and** chip **and** wordmark match `default_search_engine`?
- [ ] After changing **Address bar** default, does the **address bar iframe** match `default_search_engine:addressbar`?
- [ ] With **opaque `file://`**, after reset + reload, do iframes receive `seed-default-search-engine-keys` before they read defaults?
- [ ] Does any path call `notifyParentDefaultSearchEngineChanged` / `default-search-engine-changed` **without** also refreshing switcher chrome when the **main** key changed?
- [ ] Compare `localStorage.getItem('default_search_engine')` on **top** vs inside each iframe (they should match after sync).

---

## 8. Code anchors (for maintenance)

- Keys and `getDefaultSearchEngineLocalStorage`: `step1.js` (~1010–1030, 1335–1360, 1229–1251, 1441–1456).
- Top sync after write: `syncTopDocumentSearchSurfacesAfterDefaultEngineKeysChanged` (~1296–1320).
- Parent handler: `set-default-search-engine` (~8671–8693).
- Iframe handlers: `seed-default-search-engine-keys`, `mirror-default-search-engine`, `refresh-search-engine-switcher-from-storage`, `refresh-search-access-point-placeholder` (~2635–2715).
- Overlay keys / postMessage: `search-settings.html` (~1009+).

Set `localStorage.setItem('debug_search_engine_default_sync', 'true')` and reload for extra console diagnostics where implemented (`step1.js` ~1412, ~1550).
