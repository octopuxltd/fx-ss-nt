# API Configuration Setup

This project uses API keys that are stored securely and not committed to the repository.

## Local Development

1. Copy the example config file:
   ```bash
   cp config.example.js config.js
   ```

2. Edit `config.js` and add your actual API keys:
   ```javascript
   window.API_CONFIG = {
       // Choose which AI provider to use: 'openrouter', 'claude', or 'openai'
       AI_PROVIDER: 'openrouter',
       
       OPENROUTER_API_KEY: 'your-actual-openrouter-key',
       CLAUDE_API_KEY: 'your-actual-claude-key',
       OPENAI_API_KEY: 'your-actual-openai-key',
       PEXELS_API_KEY: 'your-actual-pexels-key'
   };
   ```

3. The `config.js` file is gitignored and will not be committed to the repository.

## GitHub Pages Deployment

For GitHub Pages deployment, API keys are injected from GitHub Secrets during the build process.

### Setting up GitHub Secrets

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add the following secrets:
   - `AI_PROVIDER`: Set to `openrouter`, `claude`, or `openai`
   - `OPENROUTER_API_KEY`: Your OpenRouter API key (if using OpenRouter)
   - `CLAUDE_API_KEY`: Your Claude API key (if using Claude)
   - `OPENAI_API_KEY`: Your OpenAI API key (if using OpenAI)
   - `PEXELS_API_KEY`: Your Pexels API key

### How it works

The `.github/workflows/deploy.yml` workflow:
1. Checks out the repository
2. Creates `config.js` from the GitHub Secrets
3. Deploys to GitHub Pages

The `config.js` file is generated during deployment and contains the API keys from GitHub Secrets. This ensures:
- ✅ API keys are not exposed in the repository
- ✅ API keys are available to GitHub Pages
- ✅ Each deployment uses the latest secrets

## Netlify deployment

`config.js` is not in git, so a fresh Netlify deploy has **no API keys** until you wire secrets into the build.

1. In the Netlify UI: **Site configuration** → **Environment variables**, add at least one key your chosen provider needs (see `step1.js` — default provider is `openai` from `localStorage`, usually **`OPENAI_API_KEY`**):
   - `OPENAI_API_KEY`
   - `OPENROUTER_API_KEY` (if you use an `openrouter-*` provider)
   - `CLAUDE_API_KEY` (if you use Claude)
   - `PEXELS_API_KEY` (for background imagery, if used)

2. Ensure **Build settings** use the repo’s `netlify.toml` (or set manually):
   - **Build command:** `node scripts/write-config-from-env.js`
   - **Publish directory:** `.`

3. Trigger a new deploy. The build writes `config.js` before publish so `step1.html` can load it.

4. **Serverless AI proxy (CORS):** OpenAI, Anthropic, and OpenRouter do not allow arbitrary browser origins on their public APIs. This repo includes `netlify/functions/ai-proxy.js`. On Netlify, the same **environment variables** used for the build (`OPENAI_API_KEY`, etc.) are read by the function at **request time** — ensure they are available to **Functions** (site env vars usually are). No extra deploy step is required beyond pushing the function.

5. **Custom domains:** If the site is served from a non-`*.netlify.app` hostname, set Netlify env **`AI_PROXY_EXTRA_ORIGINS`** to a comma-separated list of exact origins (e.g. `https://search.example.com`) so the proxy’s CORS allowlist matches your UI.

6. **`file://` pages:** Browsers send `Origin: null`. Set Netlify env **`AI_PROXY_ALLOW_NULL_ORIGIN=1`** only if you truly need to open HTML from disk while calling the deployed proxy, and set in **`config.js`**: `AI_PROXY_BASE: 'https://your-site.netlify.app'`. Leaving this off is safer.

### Local development

- **Same repo + AI from disk or any static server:** Direct calls to OpenAI etc. still hit **CORS** in the browser. Use one of:
  - **`netlify dev`** (default `http://localhost:8888`) — functions run locally; the app auto-uses the proxy when the port is `8888`. Put keys in Netlify env or a root `.env` loaded by Netlify CLI.
  - **Any `http://localhost` / `http://127.0.0.1` port + deployed proxy:** In local `config.js`, set `AI_PROXY_BASE` to your **deployed** site origin (e.g. `https://fxsearchnewtab.netlify.app`). The proxy allows localhost origins by default. You can omit client-side API keys when using only the proxy if the function has server keys (optional).

If keys are set but the browser still shows no AI rows, open DevTools → **Console** and **Network** for failed `fetch` (e.g. CORS or `401`). Keys in `config.js` are still visible to visitors — use provider-side limits / restricted keys.

**Proxy returns `401` from OpenAI:** The function is reaching OpenAI but the **server** `OPENAI_API_KEY` is wrong, revoked, or pasted with extra characters. In Netlify, re-paste the secret (no quotes), save, and redeploy. The proxy trims whitespace/newlines from env values; if 401 persists, create a new key in the OpenAI dashboard and update both **Build** and **Functions** (or “All scopes”) for that variable.

**Attempt 2 shows `500` / `Server missing OPENROUTER_API_KEY`:** Normal if you only configured OpenAI — the retry races OpenRouter. Add `OPENROUTER_API_KEY` to Netlify env or ignore that line.

## Files

- `config.example.js`: Template file (committed to repo)
- `config.js`: Actual config file (gitignored, created locally or during deployment)
- `.gitignore`: Ensures `config.js` is not committed
