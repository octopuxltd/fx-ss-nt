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
       OPENROUTER_API_KEY: 'your-actual-openrouter-key',
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
   - `OPENROUTER_API_KEY`: Your OpenRouter API key
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

## Files

- `config.example.js`: Template file (committed to repo)
- `config.js`: Actual config file (gitignored, created locally or during deployment)
- `.gitignore`: Ensures `config.js` is not committed
