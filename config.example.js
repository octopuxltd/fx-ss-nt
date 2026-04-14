// API Configuration Template
// Copy this file to config.js and add your actual API keys
// config.js is gitignored and will not be committed to the repository
//
// Optional (local dev / file://):
//   AI_PROXY_BASE: 'https://your-site.netlify.app'  — call deployed Netlify AI proxy (CORS-safe)
//   USE_AI_PROXY: false  — force direct browser → provider (only works if the provider allows your origin)

window.API_CONFIG = {
    // Default AI provider in step1.js is openrouter-haiku unless localStorage.ai_provider is set
    OPENROUTER_API_KEY: 'your-openrouter-api-key-here',
    OPENAI_API_KEY: 'your-openai-api-key-here',
    CLAUDE_API_KEY: 'your-anthropic-api-key-here',
    PEXELS_API_KEY: 'your-pexels-api-key-here',
};
