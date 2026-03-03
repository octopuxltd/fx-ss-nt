// Step 1 JavaScript

// ===== API CONFIGURATION =====
// Load saved provider from localStorage, or default to OpenAI
let AI_PROVIDER = localStorage.getItem('ai_provider') || 'openai';

// Model mapping for different providers
const MODEL_MAP = {
    'openrouter-haiku': 'anthropic/claude-3-haiku',
    'openai': 'gpt-4o-mini'
};

const OPENROUTER_API_KEY = window.API_CONFIG?.OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const CLAUDE_API_KEY = window.API_CONFIG?.CLAUDE_API_KEY || '';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_API_KEY = window.API_CONFIG?.OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

console.log('[API CONFIG] Provider:', AI_PROVIDER);
console.log('[API CONFIG] OpenRouter key present:', !!OPENROUTER_API_KEY);
console.log('[API CONFIG] OpenAI key present:', !!OPENAI_API_KEY);
console.log('[API CONFIG] Claude key present:', !!CLAUDE_API_KEY);

// ===== CACHING SYSTEM =====

// LocalStorage cache functions for AI suggestions
function getCacheKey(query) {
    return `ai_suggestions_${query.toLowerCase().trim()}`;
}

function getCachedSuggestions(query) {
    try {
        const cacheKey = getCacheKey(query);
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            // Check if cache is still valid (24 hours)
            const cacheAge = Date.now() - parsed.timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            if (cacheAge < maxAge) {
                console.log('[CACHE] Found cached suggestions:', parsed.suggestions);
                // Filter cached suggestions to only include word-start matches
                const queryLower = query.toLowerCase();
                const filtered = parsed.suggestions.filter(suggestion => {
                    const suggestionLower = suggestion.toLowerCase();
                    // Check if suggestion starts with query
                    if (suggestionLower.startsWith(queryLower)) {
                        return true;
                    }
                    // Check if any word in the suggestion starts with the query
                    const words = suggestionLower.split(/\s+/);
                    return words.some(word => word.startsWith(queryLower));
                });
                console.log('[CACHE] Filtered', parsed.suggestions.length, 'cached suggestions to', filtered.length, 'matching query');
                return filtered.length > 0 ? filtered : null;
            } else {
                console.log('[CACHE] Cache expired, removing old cache');
                localStorage.removeItem(cacheKey);
            }
        }
    } catch (error) {
        console.error('[CACHE] Error reading from cache:', error);
    }
    return null;
}

function cacheSuggestions(query, suggestions) {
    try {
        const cacheKey = getCacheKey(query);
        const cacheData = {
            suggestions: suggestions,
            timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        console.log('[CACHE] Cached', suggestions.length, 'suggestions for:', query);
    } catch (error) {
        console.error('[CACHE] Error caching suggestions:', error);
        // localStorage might be full, try to clear old entries
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('ai_suggestions_')) {
                    keysToRemove.push(key);
                }
            }
            // Remove oldest 10 entries if cache is full
            if (keysToRemove.length > 50) {
                keysToRemove.slice(0, 10).forEach(key => localStorage.removeItem(key));
                // Retry caching
                localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            }
        } catch (e) {
            console.error('[CACHE] Could not clear cache:', e);
        }
    }
}

// Firefox suggestions cache functions
function getFirefoxCacheKey(query) {
    return `firefox_suggestions_${query.toLowerCase().trim()}`;
}

function getCachedFirefoxSuggestions(query) {
    try {
        const cacheKey = getFirefoxCacheKey(query);
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            // Check if cache is still valid (24 hours)
            const cacheAge = Date.now() - parsed.timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            if (cacheAge < maxAge) {
                console.log('[CACHE-FIREFOX] Found cached Firefox suggestions:', parsed.selectedSuggestions ? parsed.selectedSuggestions.length : parsed.suggestions?.length, '| Count to show:', parsed.countToShow);
                // Return both selected suggestions and count to show
                return {
                    selectedSuggestions: parsed.selectedSuggestions || parsed.suggestions,
                    countToShow: parsed.countToShow || (parsed.selectedSuggestions ? parsed.selectedSuggestions.length : parsed.suggestions?.length || 0)
                };
            } else {
                console.log('[CACHE-FIREFOX] Cache expired, removing old cache');
                localStorage.removeItem(cacheKey);
            }
        }
    } catch (error) {
        console.error('[CACHE-FIREFOX] Error reading from cache:', error);
    }
    return null;
}

function cacheFirefoxSuggestions(query, selectedSuggestions, countToShow) {
    try {
        if (!selectedSuggestions || selectedSuggestions.length === 0) {
            return; // Don't cache empty results
        }
        const cacheKey = getFirefoxCacheKey(query);
        const cacheData = {
            selectedSuggestions: selectedSuggestions,
            countToShow: countToShow || selectedSuggestions.length,
            timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        console.log('[CACHE-FIREFOX] Cached', selectedSuggestions.length, 'Firefox suggestions for:', query, '| Count to show:', countToShow);
    } catch (error) {
        console.error('[CACHE-FIREFOX] Error caching Firefox suggestions:', error);
        // localStorage might be full, try to clear old entries
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('firefox_suggestions_')) {
                    keysToRemove.push(key);
                }
            }
            // Remove oldest entries first (simple approach: remove first 10)
            keysToRemove.slice(0, 10).forEach(key => localStorage.removeItem(key));
            // Retry caching
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (e) {
            console.error('[CACHE-FIREFOX] Could not clear cache:', e);
        }
    }
}

// ===== AI SEARCH SUGGESTIONS API =====

async function makeSearchSuggestionsRequest(query, attemptNumber, delayMs = 0, providerOverride = null) {
    const provider = providerOverride || AI_PROVIDER;
    const modelName = MODEL_MAP[provider] || provider;
    console.log(`[API-SEARCH] ===== Starting search suggestions attempt ${attemptNumber} for query: "${query}" (provider: ${provider}, model: ${modelName}) =====`);
    
    if (delayMs > 0) {
        console.log(`[API-SEARCH] Waiting ${delayMs}ms before attempt ${attemptNumber}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    const startTime = Date.now();
    console.log(`[API-SEARCH] Making request attempt ${attemptNumber} for query: "${query}"`);
    
    // Determine which API to use based on provider
    const isOpenRouter = provider.startsWith('openrouter-');
    const isOpenAI = provider === 'openai';
    
    // Check API key based on provider
    if (provider === 'claude' && !CLAUDE_API_KEY) {
        console.error('[API-SEARCH] ✗ Claude API key not set');
        throw new Error('Claude API key not set');
    } else if (provider.startsWith('openrouter-') && !OPENROUTER_API_KEY) {
        console.error('[API-SEARCH] ✗ OpenRouter API key not set');
        throw new Error('OpenRouter API key not set');
    } else if (isOpenAI && !OPENAI_API_KEY) {
        console.error('[API-SEARCH] ✗ OpenAI API key not set');
        throw new Error('OpenAI API key not set');
    }
    console.log('[API-SEARCH] ✓ API key is set');
    
    const systemPrompt = 'You are a search suggestion generator. Generate 10 popular search queries where at least one word starts with the user\'s query characters. Prioritize nouns - names of famous things like celebrities, bands, movies, places, politicians, news topics, or common questions (how to do things, why something happens). For example, if the user types "abc", return suggestions like "abc news", "abc store", "abc company" where words start with "abc". The query characters need not form a complete word - they are the beginning of words. Return ONLY a JSON array of 10 search queries, sorted by popularity. No explanations, just the JSON array.';
    const userPrompt = `Generate 10 popular search suggestions where at least one word starts with: "${query}". Prioritize nouns - famous people, places, movies, bands, news topics, or common questions (how to, why). Return only a JSON array of strings.`;
    
    const promptTimestamp = new Date().toISOString();
    console.log(`[API-SEARCH] [${promptTimestamp}] Prompt sent to ${provider}:`, userPrompt);
    
    let response, data, content;
    
    if (isOpenAI) {
        // OpenAI API request
        const requestBody = {
            model: MODEL_MAP[provider],
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 200
        };
        
        response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });
        
        const requestDuration = Date.now() - startTime;
        console.log(`[API-SEARCH] Attempt ${attemptNumber} response received:`, {
            status: response.status,
            duration: `${requestDuration}ms`
        });
        
        if (!response.ok) {
            let errorText;
            try {
                errorText = await response.text();
            } catch (e) {
                errorText = 'Could not read error response';
            }
            const error = new Error(`API error: ${response.status} - ${errorText}`);
            error.hasResponse = true;
            throw error;
        }
        
        data = await response.json();
        content = data.choices?.[0]?.message?.content?.trim();
    } else if (AI_PROVIDER === 'claude') {
        // Claude API request
        const requestBody = {
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 200,
            temperature: 0.7,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
        };
        
        response = await fetch(CLAUDE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestBody)
        });
        
        const requestDuration = Date.now() - startTime;
        console.log(`[API-SEARCH] Attempt ${attemptNumber} response received:`, {
            status: response.status,
            duration: `${requestDuration}ms`
        });
        
        if (!response.ok) {
            let errorText;
            try {
                errorText = await response.text();
            } catch (e) {
                errorText = 'Could not read error response';
            }
            const error = new Error(`API error: ${response.status} - ${errorText}`);
            error.hasResponse = true;
            throw error;
        }
        
        data = await response.json();
        content = data.content?.[0]?.text?.trim();
    } else {
        // OpenRouter API request
        const requestBody = {
            model: MODEL_MAP[provider] || 'anthropic/claude-3-haiku',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 200
        };
        
        response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Search Suggestions'
            },
            body: JSON.stringify(requestBody)
        });
        
        const requestDuration = Date.now() - startTime;
        console.log(`[API-SEARCH] Attempt ${attemptNumber} response received:`, {
            status: response.status,
            duration: `${requestDuration}ms`
        });
        
        if (!response.ok) {
            let errorText;
            try {
                errorText = await response.text();
            } catch (e) {
                errorText = 'Could not read error response';
            }
            const error = new Error(`API error: ${response.status} - ${errorText}`);
            error.hasResponse = true;
            throw error;
        }
        
        data = await response.json();
        content = data.choices[0]?.message?.content?.trim();
    }
    
    if (!content) {
        const error = new Error('Empty content in response');
        error.hasResponse = true;
        throw error;
    }
    
    // Parse JSON response
    let suggestions = [];
    try {
        // Try to parse as JSON object first
        const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
            const parsed = JSON.parse(jsonObjectMatch[0]);
            if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
                suggestions = parsed.suggestions;
            }
        }
        
        // If no object found or suggestions empty, try array
        if (suggestions.length === 0) {
            const jsonArrayMatch = content.match(/\[.*\]/s);
            if (jsonArrayMatch) {
                suggestions = JSON.parse(jsonArrayMatch[0]);
            } else {
                suggestions = content.split('\n')
                    .map(line => line.trim().replace(/^[-•\d.\s"']+|[-•\d.\s"']+$/g, ''))
                    .filter(line => line.length > 0)
                    .slice(0, 9);
            }
        }
    } catch (parseError) {
        const quotedMatches = content.match(/"([^"]+)"/g);
        if (quotedMatches) {
            suggestions = quotedMatches.map(m => m.replace(/"/g, '')).slice(0, 9);
        }
    }
    
    const finalSuggestions = suggestions.filter(s => s && s.length > 0).slice(0, 9);
    
    const responseTimestamp = new Date().toISOString();
    console.log(`[API-SEARCH] [${responseTimestamp}] Response received:`, finalSuggestions);
    console.log(`[API-SEARCH] Attempt ${attemptNumber} succeeded with ${finalSuggestions.length} suggestions`);
    
    if (finalSuggestions.length === 0) {
        const error = new Error('No suggestions parsed');
        error.hasResponse = true;
        throw error;
    }
    
    return finalSuggestions;
}

async function raceProviders(query, attemptNumber) {
    console.log(`[API-SEARCH] Attempt ${attemptNumber}: Racing both providers`);
    
    const providers = ['openrouter-haiku', 'openai'];
    const promises = providers.map(provider => 
        makeSearchSuggestionsRequest(query, attemptNumber, 0, provider)
            .then(result => ({ provider, result }))
            .catch(error => ({ provider, error }))
    );
    
    // Wait for the first successful response
    const results = await Promise.all(promises);
    const successful = results.find(r => !r.error);
    
    if (successful) {
        console.log(`[API-SEARCH] Attempt ${attemptNumber}: ${successful.provider} responded first with success`);
        return successful.result;
    }
    
    // If both failed, throw the first error
    console.error(`[API-SEARCH] Attempt ${attemptNumber}: Both providers failed`);
    throw results[0].error;
}

async function fetchSearchSuggestions(query, maxRetries = 2) {
    let resolveFirst = null;
    let rejectFirst = null;
    const firstResponsePromise = new Promise((resolve, reject) => {
        resolveFirst = resolve;
        rejectFirst = reject;
    });

    const errors = [];
    const totalAttempts = maxRetries + 1;
    let completed = false;
    let finishedAttempts = 0;

    function handleAttemptResult(attemptNumber, result, error) {
        if (completed) {
            return;
        }

        if (error) {
            finishedAttempts++;
            console.log(`[API-SEARCH] Attempt ${attemptNumber} failed:`, error.message);
            errors.push({ attempt: attemptNumber, error });

            if (finishedAttempts === totalAttempts) {
                completed = true;
                rejectFirst(new Error('All search attempts failed'));
            }
            return;
        }

        completed = true;
        resolveFirst({ result, attempt: attemptNumber });
    }

    // Attempt 1: Use selected provider
    makeSearchSuggestionsRequest(query, 1, 0)
        .then(result => handleAttemptResult(1, result, null))
        .catch(error => handleAttemptResult(1, null, error));

    // Attempt 2: Race both providers after 2s
    setTimeout(() => {
        if (completed) return;
        raceProviders(query, 2)
            .then(result => handleAttemptResult(2, result, null))
            .catch(error => handleAttemptResult(2, null, error));
    }, 2000);

    // Attempt 3: Retry selected provider after 4s
    setTimeout(() => {
        if (completed) return;
        makeSearchSuggestionsRequest(query, 3, 0)
            .then(result => handleAttemptResult(3, result, null))
            .catch(error => handleAttemptResult(3, null, error));
    }, 4000);

    return firstResponsePromise;
}

// ===== FIREFOX SUGGESTIONS API =====

async function makeFirefoxSuggestionsRequest(query, attemptNumber, delayMs = 0) {
    const modelName = MODEL_MAP[AI_PROVIDER] || AI_PROVIDER;
    console.log(`[API-FIREFOX] ===== Starting Firefox suggestions attempt ${attemptNumber} for query: "${query}" (provider: ${AI_PROVIDER}, model: ${modelName}) =====`);
    
    if (delayMs > 0) {
        console.log(`[API-FIREFOX] Waiting ${delayMs}ms before attempt ${attemptNumber}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    const startTime = Date.now();
    console.log(`[API-FIREFOX] Making request attempt ${attemptNumber} for query: "${query}"`);
    
    // Determine which API to use based on provider
    const isOpenRouter = AI_PROVIDER.startsWith('openrouter-');
    const isOpenAI = AI_PROVIDER === 'openai';
    
    // Check API key based on provider
    if (AI_PROVIDER === 'claude' && !CLAUDE_API_KEY) {
        console.error('[API-FIREFOX] ✗ Claude API key not set');
        throw new Error('Claude API key not set');
    } else if (AI_PROVIDER.startsWith('openrouter-') && !OPENROUTER_API_KEY) {
        console.error('[API-FIREFOX] ✗ OpenRouter API key not set');
        throw new Error('OpenRouter API key not set');
    } else if (isOpenAI && !OPENAI_API_KEY) {
        console.error('[API-FIREFOX] ✗ OpenAI API key not set');
        throw new Error('OpenAI API key not set');
    }
    console.log('[API-FIREFOX] ✓ API key is set');
    
    const systemPrompt = 'You are a browser history suggestion generator. Generate 4 Firefox suggestions (page titles from simulated browser history related to the query). Each Firefox suggestion should be an object with "title" (page title), "url" (realistic full web address starting with "www." including a path, like "www.example.com/article/topic" or "www.site.com/page/subpage"), and "description" (exactly 60 characters, a simulated meta description). IMPORTANT: All 4 suggestions must come from different websites (different domains). Return ONLY a JSON array of 4 objects, each with title, url, description. No explanations, just the JSON array.';
    const userPrompt = `Generate 4 Firefox suggestions related to "${query}". Each Firefox suggestion should be an object with: "title" (page title), "url" (realistic full web address starting with "www." including a path, like "www.example.com/article/topic" or "www.site.com/page/subpage"), and "description" (exactly 60 characters, a simulated meta description). IMPORTANT: All 4 suggestions must come from different websites (different domains). Return only a JSON array.`;
    
    let response, data, content;
    
    if (isOpenAI) {
        // OpenAI API request
        const requestBody = {
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 300
        };
        
        response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });
        
        const requestDuration = Date.now() - startTime;
        console.log(`[API-FIREFOX] Attempt ${attemptNumber} response received:`, {
            status: response.status,
            duration: `${requestDuration}ms`
        });
        
        if (!response.ok) {
            let errorText;
            try {
                errorText = await response.text();
            } catch (e) {
                errorText = 'Could not read error response';
            }
            const error = new Error(`API error: ${response.status} - ${errorText}`);
            error.hasResponse = true;
            throw error;
        }
        
        data = await response.json();
        content = data.choices?.[0]?.message?.content?.trim();
    } else if (AI_PROVIDER === 'claude') {
        // Claude API request
        const requestBody = {
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 300,
            temperature: 0.7,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
        };
        
        response = await fetch(CLAUDE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestBody)
        });
        
        const requestDuration = Date.now() - startTime;
        console.log(`[API-FIREFOX] Attempt ${attemptNumber} response received:`, {
            status: response.status,
            duration: `${requestDuration}ms`
        });
        
        if (!response.ok) {
            let errorText;
            try {
                errorText = await response.text();
            } catch (e) {
                errorText = 'Could not read error response';
            }
            const error = new Error(`API error: ${response.status} - ${errorText}`);
            error.hasResponse = true;
            throw error;
        }
        
        data = await response.json();
        content = data.content?.[0]?.text?.trim();
    } else {
        // OpenRouter API request
        const requestBody = {
            model: MODEL_MAP[AI_PROVIDER] || 'anthropic/claude-3-haiku',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 300
        };
        
        response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Search Suggestions'
            },
            body: JSON.stringify(requestBody)
        });
        
        const requestDuration = Date.now() - startTime;
        console.log(`[API-FIREFOX] Attempt ${attemptNumber} response received:`, {
            status: response.status,
            duration: `${requestDuration}ms`
        });
        
        if (!response.ok) {
            let errorText;
            try {
                errorText = await response.text();
            } catch (e) {
                errorText = 'Could not read error response';
            }
            const error = new Error(`API error: ${response.status} - ${errorText}`);
            error.hasResponse = true;
            throw error;
        }
        
        data = await response.json();
        content = data.choices[0]?.message?.content?.trim();
    }
    
    if (!content) {
        const error = new Error('Empty content in response');
        error.hasResponse = true;
        throw error;
    }
    
    // Parse JSON response
    let firefoxSuggestions = [];
    try {
        const jsonArrayMatch = content.match(/\[.*\]/s);
        if (jsonArrayMatch) {
            const parsed = JSON.parse(jsonArrayMatch[0]);
            if (Array.isArray(parsed)) {
                firefoxSuggestions = parsed;
            }
        } else {
            const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
            if (jsonObjectMatch) {
                const parsed = JSON.parse(jsonObjectMatch[0]);
                if (parsed.firefoxSuggestions && Array.isArray(parsed.firefoxSuggestions)) {
                    firefoxSuggestions = parsed.firefoxSuggestions;
                }
                if (parsed.historyTitles && Array.isArray(parsed.historyTitles)) {
                    firefoxSuggestions = parsed.historyTitles;
                }
            }
        }
        
        console.log(`[API-FIREFOX] Parsed ${firefoxSuggestions.length} Firefox suggestions from response`);
    } catch (parseError) {
        console.error('[API-FIREFOX] Parse error:', parseError);
    }
    
    // Filter and validate Firefox suggestions
    const validFirefoxSuggestions = firefoxSuggestions
        .filter(item => {
            if (typeof item === 'object' && item.title) {
                return item.title && item.title.length > 0;
            }
            return false;
        })
        .slice(0, 4);
    
    console.log(`[API-FIREFOX] Attempt ${attemptNumber} succeeded with ${validFirefoxSuggestions.length} valid Firefox suggestions`);
    
    return validFirefoxSuggestions;
}

async function fetchFirefoxSuggestions(query, maxRetries = 2) {
    let resolveFirst = null;
    let rejectFirst = null;
    const firstResponsePromise = new Promise((resolve, reject) => {
        resolveFirst = resolve;
        rejectFirst = reject;
    });

    const errors = [];
    const totalAttempts = maxRetries + 1;
    let completed = false;
    let finishedAttempts = 0;

    function handleAttemptResult(attemptNumber, result, error) {
        if (completed) return;

        if (error) {
            finishedAttempts++;
            console.log(`[API-FIREFOX] Attempt ${attemptNumber} failed:`, error.message);
            errors.push({ attempt: attemptNumber, error });

            if (finishedAttempts === totalAttempts) {
                completed = true;
                rejectFirst(new Error('All Firefox attempts failed'));
            }
            return;
        }

        completed = true;
        resolveFirst({ result, attempt: attemptNumber });
    }

    // Attempt 1 immediately, then additional attempts after 2s and 4s
    makeFirefoxSuggestionsRequest(query, 1, 0)
        .then(result => handleAttemptResult(1, result, null))
        .catch(error => handleAttemptResult(1, null, error));

    setTimeout(() => {
        if (completed) return;
        makeFirefoxSuggestionsRequest(query, 2, 0)
            .then(result => handleAttemptResult(2, result, null))
            .catch(error => handleAttemptResult(2, null, error));
    }, 2000);

    setTimeout(() => {
        if (completed) return;
        makeFirefoxSuggestionsRequest(query, 3, 0)
            .then(result => handleAttemptResult(3, result, null))
            .catch(error => handleAttemptResult(3, null, error));
    }, 4000);

    return firstResponsePromise;
}

// ===== MAIN FETCH FUNCTION =====

async function fetchAISuggestions(query, retryCount = 0) {
    const maxRetries = 2;
    console.log('[API] Starting fetchAISuggestions for query:', query, retryCount > 0 ? `(retry ${retryCount}/${maxRetries})` : '');
    
    // Check cache first (only on first attempt, not retries)
    let cachedSuggestions = null;
    let cachedFirefoxData = null;
    let cachedSelectedFirefoxSuggestions = null;
    let cachedFirefoxCountToShow = null;
    
    if (retryCount === 0) {
        cachedSuggestions = getCachedSuggestions(query);
        cachedFirefoxData = getCachedFirefoxSuggestions(query);
        if (cachedFirefoxData) {
            cachedSelectedFirefoxSuggestions = cachedFirefoxData.selectedSuggestions;
            cachedFirefoxCountToShow = cachedFirefoxData.countToShow;
        }
        if (cachedSuggestions && cachedSuggestions.length > 0) {
            console.log('[API] Found', cachedSuggestions.length, 'cached suggestions');
        }
        if (cachedSelectedFirefoxSuggestions && cachedSelectedFirefoxSuggestions.length > 0) {
            console.log('[API-FIREFOX] Found', cachedSelectedFirefoxSuggestions.length, 'cached Firefox suggestions | Count to show:', cachedFirefoxCountToShow);
        }
    }
    
    // Make both requests concurrently
    const searchPromise = fetchSearchSuggestions(query, maxRetries);
    const firefoxPromise = cachedSelectedFirefoxSuggestions && cachedSelectedFirefoxSuggestions.length > 0
        ? Promise.resolve(cachedSelectedFirefoxSuggestions)
        : fetchFirefoxSuggestions(query, maxRetries);
    
    try {
        const [searchResults, firefoxResults] = await Promise.allSettled([searchPromise, firefoxPromise]);
        
        let finalSuggestions = [];
        let firefoxSuggestions = [];
        
        // Handle search suggestions
        if (searchResults.status === 'fulfilled') {
            finalSuggestions = searchResults.value.result || searchResults.value;
            if (finalSuggestions.length > 0) {
                cacheSuggestions(query, finalSuggestions);
            }
        } else {
            console.error('[API] Search suggestions failed:', searchResults.reason);
        }
        
        // Handle Firefox suggestions
        if (firefoxResults.status === 'fulfilled') {
            firefoxSuggestions = firefoxResults.value.result || firefoxResults.value || [];
            console.log('[API] Received', firefoxSuggestions.length, 'Firefox suggestions');
        } else {
            console.error('[API] Firefox suggestions failed:', firefoxResults.reason);
            firefoxSuggestions = [];
        }
        
        // Merge cached suggestions with AI results
        if (cachedSuggestions && cachedSuggestions.length > 0) {
            if (cachedSuggestions.length >= 9) {
                finalSuggestions = [...cachedSuggestions];
                console.log('[API] Using', cachedSuggestions.length, 'cached suggestions as base');
            } else {
                console.log('[API] Merging', cachedSuggestions.length, 'cached with', finalSuggestions.length, 'AI suggestions');
                const combined = [...cachedSuggestions];
                finalSuggestions.forEach(aiSuggestion => {
                    const aiLower = aiSuggestion.toLowerCase();
                    if (!combined.some(s => s.toLowerCase() === aiLower)) {
                        combined.push(aiSuggestion);
                    }
                });
                finalSuggestions = combined.slice(0, 9);
            }
        }
        
        // Process Firefox suggestions - replace last N suggestions
        let selectedFirefoxSuggestions = [];
        if (firefoxSuggestions && firefoxSuggestions.length > 0) {
            console.log('[API] Processing', firefoxSuggestions.length, 'Firefox suggestions');
            
            if (cachedSelectedFirefoxSuggestions && cachedSelectedFirefoxSuggestions.length > 0) {
                // Use cached Firefox suggestions
                selectedFirefoxSuggestions = cachedSelectedFirefoxSuggestions;
                const numToReplace = cachedFirefoxCountToShow || selectedFirefoxSuggestions.length;
                
                const firefoxTitles = selectedFirefoxSuggestions.map(item => item.title);
                const actualNumToReplace = Math.min(numToReplace, Math.max(finalSuggestions.length, 0));
                const keepCount = Math.max(0, finalSuggestions.length - actualNumToReplace);
                
                if (finalSuggestions.length === 0) {
                    finalSuggestions = firefoxTitles.slice(0, 9);
                } else {
                    finalSuggestions = [
                        ...finalSuggestions.slice(0, keepCount),
                        ...firefoxTitles
                    ].slice(0, 9);
                }
            } else {
                // Generate new Firefox suggestions
                const validFirefoxSuggestions = firefoxSuggestions
                    .filter(item => typeof item === 'object' && item.title && item.title.length > 0)
                    .slice(0, 4);
                
                if (validFirefoxSuggestions.length > 0) {
                    const maxCount = Math.min(validFirefoxSuggestions.length, 4);
                    const minCount = Math.min(2, maxCount);
                    const numToReplace = minCount === maxCount ? maxCount : Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
                    
                    selectedFirefoxSuggestions = validFirefoxSuggestions.slice(0, numToReplace);
                    const firefoxTitles = selectedFirefoxSuggestions.map(item => item.title);
                    
                    const actualNumToReplace = Math.min(numToReplace, Math.max(finalSuggestions.length, 0));
                    const keepCount = Math.max(0, finalSuggestions.length - actualNumToReplace);
                    
                    if (finalSuggestions.length === 0) {
                        finalSuggestions = firefoxTitles.slice(0, 9);
                    } else {
                        finalSuggestions = [
                            ...finalSuggestions.slice(0, keepCount),
                            ...firefoxTitles
                        ].slice(0, 9);
                    }
                    
                    // Cache the selected Firefox suggestions
                    cacheFirefoxSuggestions(query, selectedFirefoxSuggestions, numToReplace);
                }
            }
        }
        
        // Store Firefox suggestions metadata
        finalSuggestions._firefoxSuggestions = selectedFirefoxSuggestions;
        
        // Fallback to cached suggestions if API failed
        if (finalSuggestions.length === 0 && cachedSuggestions && cachedSuggestions.length > 0) {
            console.log('[API] API failed, returning', cachedSuggestions.length, 'cached suggestions as fallback');
            return cachedSuggestions;
        }
        
        return finalSuggestions;
    } catch (error) {
        console.error('[API] Error fetching suggestions:', error);
        if (cachedSuggestions && cachedSuggestions.length > 0) {
            console.log('[API] API failed, returning', cachedSuggestions.length, 'cached suggestions as fallback');
            return cachedSuggestions;
        }
        return [];
    }
}

console.log('[INIT] Script loading, checking reduced motion in localStorage');
const initialReducedMotion = localStorage.getItem('reduced_motion_enabled');
console.log('[INIT] Reduced motion in localStorage:', initialReducedMotion);

document.addEventListener('DOMContentLoaded', () => {
    console.log('[DOM] DOMContentLoaded fired');
    console.log('[DOM] Body has reduced-motion class?', document.body.classList.contains('reduced-motion'));
    const searchInput = document.querySelector('.search-input');
    const searchContainer = document.querySelector('.search-container');
    const firefoxLogo = document.querySelector('.firefox-logo');
    const searchBoxWrapper = document.querySelector('.search-box-wrapper');
    const searchBoxWrapperOuter = document.querySelector('.search-box-wrapper-outer');
    const reducedMotionCheckbox = document.querySelector('.reduced-motion-checkbox');
    const suggestionsList = document.querySelector('.suggestions-list');
    const suggestionItems = document.querySelectorAll('.suggestion-item');
    const searchSwitcherButton = document.querySelector('.search-switcher-button');
    
    // Click on search-box-wrapper focuses the input
    if (searchBoxWrapper && searchInput) {
        searchBoxWrapper.addEventListener('click', (e) => {
            // Don't focus if clicking on a button
            if (e.target.closest('.search-switcher-button') || e.target.closest('.search-button')) {
                return;
            }
            searchInput.focus();
        });
    }
    
    // Close switcher dropdown when hovering over suggestion items or headings
    if (suggestionsList && searchSwitcherButton) {
        // Delegate to handle both existing items and any future items
        suggestionsList.addEventListener('mouseover', (e) => {
            const target = e.target.closest('.suggestion-item, .suggestions-heading');
            if (target && searchSwitcherButton.classList.contains('open')) {
                console.log('[SUGGESTION ITEM HOVER] Closing switcher dropdown');
                searchSwitcherButton.classList.remove('open');
            }
        });
    }
    
    // Handle search switcher button dropdown
    if (searchSwitcherButton) {
        searchSwitcherButton.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent input from blurring
        });
        
        searchSwitcherButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasOpen = searchSwitcherButton.classList.contains('open');
            searchSwitcherButton.classList.toggle('open');
            const isNowOpen = searchSwitcherButton.classList.contains('open');
            
            console.log('[SWITCHER CLICK] Clicked search switcher button');
            console.log('[SWITCHER CLICK] Was open:', wasOpen, '→ Now open:', isNowOpen);
            console.log('[SWITCHER CLICK] Search input focused?', document.activeElement === searchInput);
            console.log('[SWITCHER CLICK] Suggestions visible?', searchContainer?.classList.contains('focused'));
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-switcher-button')) {
                const wasOpen = searchSwitcherButton.classList.contains('open');
                if (wasOpen) {
                    console.log('[OUTSIDE CLICK] Closing switcher dropdown');
                }
                searchSwitcherButton.classList.remove('open');
            }
        });
    }
    
    // Handle reduced motion checkbox
    if (reducedMotionCheckbox) {
        // Load saved state from localStorage
        const savedReducedMotion = localStorage.getItem('reduced_motion_enabled');
        console.log('[CHECKBOX] Saved reduced motion:', savedReducedMotion);
        if (savedReducedMotion === 'true') {
            console.log('[CHECKBOX] Adding reduced-motion class to body');
            reducedMotionCheckbox.checked = true;
            document.body.classList.add('reduced-motion');
            console.log('[CHECKBOX] Body classes after add:', document.body.className);
        }
        
        reducedMotionCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('reduced-motion');
                localStorage.setItem('reduced_motion_enabled', 'true');
            } else {
                document.body.classList.remove('reduced-motion');
                localStorage.setItem('reduced_motion_enabled', 'false');
            }
        });
    }
    
    // Calculate and set border radius based on wrapper height
    const updateBorderRadius = () => {
        console.log('[BORDER-RADIUS] Calculating border radiuses...');
        
        if (searchBoxWrapper && searchBoxWrapperOuter) {
            const wrapperHeight = searchBoxWrapper.offsetHeight;
            const borderRadius = wrapperHeight / 2;
            const gradientBorderRadius = borderRadius + 2;

            searchBoxWrapper.style.borderRadius = `${borderRadius}px`;
            searchBoxWrapperOuter.style.borderRadius = `${borderRadius}px`;
            
            const outerComputedRadius = getComputedStyle(searchBoxWrapperOuter).borderRadius;
            const innerComputedRadius = getComputedStyle(searchBoxWrapper).borderRadius;
            
            console.log('[BORDER-RADIUS] Search box wrapper:', {
                wrapperHeight: wrapperHeight,
                calculatedInnerRadius: borderRadius,
                calculatedOuterRadius: borderRadius,
                calculatedGradientRadius: gradientBorderRadius,
                renderedInnerRadius: innerComputedRadius,
                renderedOuterRadius: outerComputedRadius
            });
            
            // The ::before element needs extra radius since it extends outward by 2px
            document.documentElement.style.setProperty('--outer-border-radius', `${gradientBorderRadius}px`);
        }
        
        // Set search-switcher-button border radius to half its height
        const searchSwitcherBtn = document.querySelector('.search-switcher-button');
        if (searchSwitcherBtn) {
            const buttonHeight = searchSwitcherBtn.offsetHeight;
            const buttonBorderRadius = buttonHeight / 2;
            document.documentElement.style.setProperty('--switcher-button-radius', `${buttonBorderRadius}px`);
            
            console.log('[BORDER-RADIUS] Search switcher button:', {
                height: buttonHeight,
                radius: buttonBorderRadius
            });
        }

        // Set suggestion items border radius to half the first item's height
        const firstSuggestionItem = document.querySelector('.suggestion-item');
        if (firstSuggestionItem) {
            const itemHeight = firstSuggestionItem.offsetHeight;
            const itemBorderRadius = itemHeight / 2;
            document.documentElement.style.setProperty('--suggestion-item-radius', `${itemBorderRadius}px`);
            
            console.log('[BORDER-RADIUS] Suggestion items:', {
                height: itemHeight,
                radius: itemBorderRadius
            });
        }
    };
    
    // Set initial border radius
    updateBorderRadius();
    
    // Update on window resize
    window.addEventListener('resize', updateBorderRadius);
    
    let firstHoverDone = false;
    let gradientAnimationId = null;
    let gradientAngle = 0;
    
    // Track state for input handler
    let lastApiQuery = '';
    let currentDisplayedSuggestions = [];
    
    // ===== INPUT EVENT HANDLER =====
    if (searchInput) {
        searchInput.addEventListener('input', async (event) => {
            console.log('[INPUT] ===== INPUT EVENT STARTED =====');
            
            const value = (event.target.value || '').toString();
            const valueLower = value.toLowerCase().trim();
            console.log('[INPUT] Raw value:', value, '| Trimmed lower:', valueLower, '| Length:', valueLower.length);
            
            // Handle empty field - show default suggestions
            if (valueLower.length === 0) {
                console.log('[INPUT] Empty field, showing default suggestions');
                const defaultSuggestions = ['hoka', '13 in macbook air', 'coffee machines for sale', 'taylor swift', 'coffee grinder'];
                // TODO: Call updateSuggestions when implemented
                console.log('[INPUT] Would update with default suggestions:', defaultSuggestions);
                currentDisplayedSuggestions = defaultSuggestions;
                return;
            }
            
            // For 3+ characters, fetch from AI
            if (valueLower.length >= 3) {
                console.log('[INPUT] ===== Branch: length >= 3 =====');
                console.log('[INPUT] Query:', valueLower, '| Length:', valueLower.length);
                
                // Check if we have existing suggestions to filter
                const hasExistingSuggestions = currentDisplayedSuggestions.length > 0;
                console.log('[INPUT] Has existing suggestions:', hasExistingSuggestions, 'count:', currentDisplayedSuggestions.length);
                
                if (hasExistingSuggestions) {
                    // TODO: Filter existing suggestions when filterExistingSuggestions is implemented
                    console.log('[INPUT] Would filter existing suggestions for query:', valueLower);
                } else {
                    // Show skeletons while waiting for AI
                    console.log('[INPUT] No existing suggestions, would show skeletons');
                    // TODO: Call showSkeletonLoaders when implemented
                }
                
                // Make API call
                console.log('[INPUT] Making immediate API call for query:', valueLower);
                lastApiQuery = valueLower;
                
                try {
                    console.log('[AI] Fetching AI suggestions for:', valueLower);
                    const aiSuggestions = await fetchAISuggestions(valueLower);
                    console.log('[AI] fetchAISuggestions returned:', aiSuggestions);
                    
                    // Only update if query hasn't changed during API call
                    const finalQuery = searchInput.value.toLowerCase().trim();
                    console.log('[AI] Final query check:', finalQuery, '===', valueLower, '?', finalQuery === valueLower);
                    
                    if (finalQuery === valueLower) {
                        console.log('[AI] ✓ Query still matches after API call');
                        
                        if (aiSuggestions && Array.isArray(aiSuggestions) && aiSuggestions.length > 0) {
                            console.log('[AI] Updating with', aiSuggestions.length, 'AI suggestions');
                            // TODO: Call updateSuggestions when implemented
                            console.log('[AI] Would update suggestions with:', aiSuggestions);
                            currentDisplayedSuggestions = aiSuggestions;
                        } else {
                            console.log('[AI] No AI suggestions returned');
                        }
                    } else {
                        console.log('[AI] Query changed during API call, ignoring results');
                    }
                } catch (error) {
                    console.error('[AI] Error fetching suggestions:', error);
                }
            }
        });
    }
    
    // Animate gradient border
    const animateGradient = () => {
        gradientAngle = (gradientAngle + 1) % 360;
        
        let style = document.getElementById('gradient-animation-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'gradient-animation-style';
        }
        style.textContent = `.search-box-wrapper-outer:focus-within::before { background: conic-gradient(from ${gradientAngle}deg, #FF00FF 0%, #FFA500 35%, #FFFFFF 50%, #FFA500 65%, #FF00FF 100%); }`;
        if (!document.head.contains(style)) {
            document.head.appendChild(style);
        }
        gradientAnimationId = requestAnimationFrame(animateGradient);
    };
    
    if (searchInput && searchContainer) {
        searchInput.addEventListener('focus', () => {
            // Add focused class to expand width
            searchContainer.classList.add('focused');
            
            // Reset first hover flag
            firstHoverDone = false;
            
            // Disable hover states during transition
            if (suggestionsList) {
                suggestionsList.classList.add('transitioning');
                
                // Remove transitioning class and enable first-hover after transition completes (0.42s)
                setTimeout(() => {
                    suggestionsList.classList.remove('transitioning');
                    suggestionsList.classList.add('first-hover-fade');
                }, 420);
            }
        });
        
        searchInput.addEventListener('blur', () => {
            // Remove focused class
            searchContainer.classList.remove('focused');
            firstHoverDone = false;
            
            // Disable hover states during transition
            if (suggestionsList) {
                suggestionsList.classList.add('transitioning');
                suggestionsList.classList.remove('first-hover-fade');
                
                // Remove transitioning class after transition completes (0.25s)
                setTimeout(() => {
                    suggestionsList.classList.remove('transitioning');
                }, 250);
            }
        });
        
        // Track first hover
        suggestionItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                if (!firstHoverDone && suggestionsList.classList.contains('first-hover-fade')) {
                    firstHoverDone = true;
                    suggestionsList.classList.remove('first-hover-fade');
                }
            }, { once: false });
        });
    }
    
    // Handle Escape key to deselect search input
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && searchInput && document.activeElement === searchInput) {
            searchInput.blur();
        }
    });
    
    // Maintain focus state when switching apps
    let wasFocusedBeforeBlur = false;
    let isRestoringFocus = false;
    
    if (searchInput && searchContainer) {
        searchInput.addEventListener('focus', () => {
            console.log('[FOCUS] Search input focused, isRestoring:', isRestoringFocus);
            console.log('[FOCUS] Suggestions panel will show');
            
            if (isRestoringFocus) {
                console.log('[FOCUS] This is a restore focus - keeping transitions suppressed');
                // Don't add focused class, it's already there
                isRestoringFocus = false;
            }
            
            // Start gradient animation (unless reduced motion is enabled)
            if (!gradientAnimationId && !document.body.classList.contains('reduced-motion')) {
                animateGradient();
            }
        });
        
        searchInput.addEventListener('blur', () => {
            console.log('[BLUR] Search input blurred');
            console.log('[BLUR] Suggestions panel will hide');
            wasFocusedBeforeBlur = searchContainer.classList.contains('focused');
            console.log('[BLUR] Was in focused state:', wasFocusedBeforeBlur);
            
            // Stop gradient animation
            if (gradientAnimationId) {
                cancelAnimationFrame(gradientAnimationId);
                gradientAnimationId = null;
            }
            const existingStyle = document.getElementById('gradient-animation-style');
            if (existingStyle) {
                existingStyle.remove();
            }
        });
        
        window.addEventListener('blur', () => {
            console.log('[WINDOW BLUR] Window lost focus');
            if (document.activeElement === searchInput) {
                wasFocusedBeforeBlur = true;
                console.log('[WINDOW BLUR] Search was focused, remembering state');
            }
        });
        
        window.addEventListener('focus', () => {
            console.log('[WINDOW FOCUS] Window gained focus, was focused before?', wasFocusedBeforeBlur);
            
            if (wasFocusedBeforeBlur) {
                console.log('[WINDOW FOCUS] Suppressing transitions and restoring focus');
                isRestoringFocus = true;
                
                // Suppress transitions
                searchContainer.style.transition = 'none';
                if (suggestionsList) suggestionsList.style.transition = 'none';
                const logo = document.querySelector('.firefox-logo');
                if (logo) logo.style.transition = 'none';
                
                // Restore focus
                searchInput.focus();
                
                // Re-enable transitions after state is restored
                setTimeout(() => {
                    console.log('[WINDOW FOCUS] Re-enabling transitions');
                    searchContainer.style.transition = '';
                    if (suggestionsList) suggestionsList.style.transition = '';
                    if (logo) logo.style.transition = '';
                }, 100);
                
                wasFocusedBeforeBlur = false;
            }
        });
    }
});
