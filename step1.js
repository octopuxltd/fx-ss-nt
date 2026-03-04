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

// ===== FIREFOX HINT TEXT =====
// Cache a date; compute relative string when rendering; show actual date on hover

function getRandomDateForType(type) {
    const now = Date.now();
    let msAgo;
    const r = Math.random();
    if (type === 'tab') {
        if (r < 0.5) msAgo = (5 + Math.floor(Math.random() * 56)) * 60 * 1000;
        else msAgo = (1 + Math.floor(Math.random() * 24)) * 60 * 60 * 1000;
    } else if (type === 'bookmark') {
        if (r < 0.5) msAgo = (1 + Math.floor(Math.random() * 4)) * 7 * 24 * 60 * 60 * 1000;
        else msAgo = (1 + Math.floor(Math.random() * 11)) * 30 * 24 * 60 * 60 * 1000;
    } else {
        if (r < 0.5) msAgo = (1 + Math.floor(Math.random() * 30)) * 24 * 60 * 60 * 1000;
        else msAgo = (1 + Math.floor(Math.random() * 4)) * 7 * 24 * 60 * 60 * 1000;
    }
    return new Date(now - msAgo).toISOString();
}

function getRelativeDateString(dateIso, type) {
    const prefixes = { history: 'You visited this page ', bookmark: 'You bookmarked this page ', tab: 'You opened this page ' };
    const prefix = prefixes[type] || prefixes.history;
    const d = new Date(dateIso);
    const now = Date.now();
    const ms = now - d.getTime();
    const mins = Math.floor(ms / 60000);
    const hours = Math.floor(ms / 3600000);
    const days = Math.floor(ms / 86400000);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    let ago;
    if (months >= 1) ago = months === 1 ? '1 month ago' : `${months} months ago`;
    else if (weeks >= 1) ago = weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    else if (days >= 1) ago = days === 1 ? 'Yesterday' : `${days} days ago`;
    else if (hours >= 1) ago = hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    else ago = mins <= 1 ? '1 minute ago' : `${mins} minutes ago`;
    return prefix + ago;
}

function getActualDateString(dateIso) {
    const d = new Date(dateIso);
    const now = new Date();
    const isToday = d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    if (isToday) {
        const hours = d.getHours();
        const mins = d.getMinutes();
        const ampm = hours >= 12 ? 'pm' : 'am';
        const h12 = hours % 12 || 12;
        const minsPadded = mins < 10 ? '0' + mins : mins;
        return `at ${h12}.${minsPadded}${ampm}`;
    }
    const day = d.getDate();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `at ${day} ${month} ${year}`;
}

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
                // Use cached Firefox suggestions (ensure each has type for backwards compatibility)
                selectedFirefoxSuggestions = cachedSelectedFirefoxSuggestions.map(item => ({ ...item }));
                const firefoxTypes = ['tab', 'bookmark', 'history'];
                let needsRecache = false;
                selectedFirefoxSuggestions.forEach((item, i) => {
                    if (!item.type) {
                        item.type = firefoxTypes[i % firefoxTypes.length];
                        item.date = getRandomDateForType(item.type);
                        needsRecache = true;
                    } else if (!item.date) {
                        item.date = getRandomDateForType(item.type);
                        needsRecache = true;
                    }
                });
                if (needsRecache) {
                    cacheFirefoxSuggestions(query, selectedFirefoxSuggestions, cachedFirefoxCountToShow || selectedFirefoxSuggestions.length);
                }
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
                    // Assign type (tab/bookmark/history) on first render; cached for consistency
                    const firefoxTypes = ['tab', 'bookmark', 'history'];
                    const shuffled = [...firefoxTypes].sort(() => Math.random() - 0.5);
                    selectedFirefoxSuggestions.forEach((item, i) => {
                        item.type = shuffled[i % shuffled.length];
                        item.date = getRandomDateForType(item.type);
                    });
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
    
    // Clear search input on page load
    if (searchInput) {
        searchInput.value = '';
        console.log('[DOM] Cleared search input on load');
    }
    const searchContainer = document.querySelector('.search-container');
    const firefoxLogo = document.querySelector('.firefox-logo');
    const searchBoxWrapper = document.querySelector('.search-box-wrapper');
    const searchBoxWrapperOuter = document.querySelector('.search-box-wrapper-outer');
    const reducedMotionCheckbox = document.querySelector('.reduced-motion-checkbox');
    const suggestionsList = document.querySelector('.suggestions-list');
    const suggestionItems = document.querySelectorAll('.suggestion-item');
    let selectedSuggestionIndex = -1;
    let originalTypedText = '';
    let hoveredSuggestionIndex = -1;
    let lastTypedTextInInput = '';
    let lastHoveredItemForInput = null;
    const searchSwitcherButton = document.querySelector('.search-switcher-button');
    const searchClearButton = document.querySelector('.search-clear-button');
    
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
    let aiSuggestionsSet = new Set();
    
    // ===== SEARCH HISTORY =====
    
    function getSearchHistory() {
        try {
            const history = localStorage.getItem('search_history');
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.error('[HISTORY] Error reading search history:', error);
            return [];
        }
    }
    
    function isInSearchHistory(text) {
        try {
            const history = getSearchHistory();
            const textLower = text.toLowerCase();
            return history.some(item => item.toLowerCase() === textLower);
        } catch (error) {
            console.error('[HISTORY] Error checking search history:', error);
            return false;
        }
    }
    
    function saveToSearchHistory(text) {
        try {
            const history = getSearchHistory();
            const textLower = text.toLowerCase();
            
            // Remove if already exists (case-insensitive)
            const filteredHistory = history.filter(item => item.toLowerCase() !== textLower);
            
            // Add to top of list
            filteredHistory.unshift(text);
            
            // Limit to 100 items
            const limitedHistory = filteredHistory.slice(0, 100);
            
            localStorage.setItem('search_history', JSON.stringify(limitedHistory));
            console.log('[HISTORY] Saved to history:', text);
        } catch (error) {
            console.error('[HISTORY] Error saving to search history:', error);
        }
    }
    
    function moveToTopOfHistory(text) {
        try {
            const history = getSearchHistory();
            const textLower = text.toLowerCase();
            const index = history.findIndex(item => item.toLowerCase() === textLower);
            
            if (index !== -1) {
                // Remove from current position and add to top
                history.splice(index, 1);
                history.unshift(text);
                localStorage.setItem('search_history', JSON.stringify(history));
                console.log('[HISTORY] Moved to top of history:', text);
            }
        } catch (error) {
            console.error('[HISTORY] Error moving in history:', error);
        }
    }
    
    // ===== ICON ASSIGNMENT =====
    
    // Icon mappings for lightning icon (popular/trending suggestions)
    const iconMappings = {
        lightning: ['taylor swift', 'trump', 'weather', 'youtube', 'news', 'spotify', 'amazon', 'netflix', 'tiktok'],
        search: []
    };
    
    function getIconForSuggestion(text) {
        try {
            const textLower = text.toLowerCase();
            
            // Check if in search history - gets clock icon
            if (isInSearchHistory(text)) {
                return 'icons/clock.svg';
            }
            
            // AI suggestions check for special mappings
            if (aiSuggestionsSet.has(textLower)) {
                // Check if it's a lightning-worthy suggestion (popular/trending)
                if (iconMappings.lightning && iconMappings.lightning.includes(textLower)) {
                    return 'icons/lightning.svg';
                } else if (iconMappings.search && iconMappings.search.includes(textLower)) {
                    return 'icons/search.svg';
                }
                return 'icons/search.svg';
            }
            
            // Default to clock icon
            return 'icons/clock.svg';
        } catch (error) {
            console.error('[ICON] Error in getIconForSuggestion:', error);
            return 'icons/search.svg';
        }
    }
    
    // ===== SKELETON LOADERS =====
    
    // Fixed skeleton widths for each row position (1-10)
    const skeletonWidths = [
        Math.floor(Math.random() * 100) + 60,
        Math.floor(Math.random() * 100) + 60,
        Math.floor(Math.random() * 100) + 60,
        Math.floor(Math.random() * 100) + 60,
        Math.floor(Math.random() * 100) + 60,
        Math.floor(Math.random() * 100) + 60,
        Math.floor(Math.random() * 100) + 60,
        Math.floor(Math.random() * 100) + 60,
        Math.floor(Math.random() * 100) + 60,
        Math.floor(Math.random() * 100) + 60
    ];
    
    function showSkeletonLoaders(count = 3) {
        console.log('[SKELETON] showSkeletonLoaders called, count:', count);
        
        const suggestionsContent = suggestionsList?.querySelector('.suggestions-content');
        if (!suggestionsContent) {
            console.log('[SKELETON] suggestions-content not found');
            return;
        }
        
        // Get current number of real suggestions
        const existingItems = suggestionsContent.querySelectorAll('.suggestion-item:not(.skeleton)');
        const startRowIndex = existingItems.length;
        
        // Generate skeletons with fixed widths
        const skeletonHTML = Array.from({ length: count }, (_, i) => {
            const rowPosition = startRowIndex + i;
            const width = skeletonWidths[rowPosition] || skeletonWidths[rowPosition % skeletonWidths.length] || 80;
            return `
                <li class="suggestion-item skeleton" data-index="-1">
                    <div class="suggestion-icon skeleton-icon"></div>
                    <span class="skeleton-text" style="width: ${width}px;"></span>
                </li>
            `;
        }).join('');
        
        console.log('[SKELETON] Adding', count, 'skeletons starting at row', startRowIndex);
        suggestionsContent.insertAdjacentHTML('beforeend', skeletonHTML);
    }
    
    function removeSkeletons() {
        const suggestionsContent = suggestionsList?.querySelector('.suggestions-content');
        if (!suggestionsContent) return;
        
        const skeletons = suggestionsContent.querySelectorAll('.skeleton');
        skeletons.forEach(skeleton => skeleton.remove());
        console.log('[SKELETON] Removed', skeletons.length, 'skeletons');
    }
    
    // ===== HIGHLIGHTING MATCHING TEXT =====
    
    function highlightMatchingText(text, searchValue, isTypedText, isGmailSuggestion) {
        if (!searchValue || isGmailSuggestion) {
            return text;
        }
        
        // For typed text, make it bold
        if (isTypedText) {
            return `<strong>${text}</strong>`;
        }
        
        const searchNoSpaces = searchValue.replace(/\s/g, '');
        const textLower = text.toLowerCase();
        const textNoSpaces = textLower.replace(/\s/g, '');
        const matchIndex = textNoSpaces.indexOf(searchNoSpaces);
        
        if (matchIndex === -1) {
            return text;
        }
        
        // Find the actual position in the original text
        let charCount = 0;
        let startIndex = -1;
        let endIndex = -1;
        
        for (let i = 0; i < text.length; i++) {
            if (text[i] !== ' ') {
                if (charCount === matchIndex) {
                    startIndex = i;
                }
                if (charCount === matchIndex + searchNoSpaces.length - 1) {
                    endIndex = i + 1;
                    break;
                }
                charCount++;
            }
        }
        
        if (startIndex !== -1 && endIndex !== -1) {
            const before = text.substring(0, startIndex);
            const match = text.substring(startIndex, endIndex);
            const after = text.substring(endIndex);
            return `${before}<strong>${match}</strong>${after}`;
        }
        
        return text;
    }
    
    // ===== FILTERING EXISTING SUGGESTIONS =====
    
    function filterExistingSuggestions(query) {
        if (!suggestionsList || currentDisplayedSuggestions.length === 0) {
            console.log('[FILTER] No suggestions to filter');
            return [];
        }
        
        const queryLower = query.toLowerCase();
        const queryLength = queryLower.length;
        
        console.log('[FILTER] Filtering', currentDisplayedSuggestions.length, 'suggestions for query:', queryLower);
        
        // Filter suggestions that match the query
        const filteredSuggestions = currentDisplayedSuggestions.filter(suggestion => {
            const suggestionLower = suggestion.toLowerCase();
            if (suggestionLower.length < queryLength) {
                return false;
            }
            // Check if suggestion starts with query or any word starts with query
            if (suggestionLower.startsWith(queryLower)) {
                return true;
            }
            const words = suggestionLower.split(/\s+/);
            return words.some(word => word.startsWith(queryLower));
        });
        
        console.log('[FILTER] Filtered to', filteredSuggestions.length, 'matching suggestions');
        
        // Update the display
        if (filteredSuggestions.length > 0) {
            updateSuggestions(filteredSuggestions);
            
            // Add skeletons to fill up to 9 total
            const skeletonCount = Math.max(0, 9 - filteredSuggestions.length);
            if (skeletonCount > 0) {
                console.log('[FILTER] Adding', skeletonCount, 'skeletons to fill list');
                showSkeletonLoaders(skeletonCount);
            }
        } else {
            console.log('[FILTER] No matching suggestions, showing all skeletons');
            updateSuggestions([]);
            showSkeletonLoaders(9);
        }
        
        return filteredSuggestions;
    }
    
    // ===== KEYBOARD NAVIGATION =====
    
    function updateSearchInputForItem(item, typedText) {
        if (!searchInput) return;
        const isGmailItem = item.classList.contains('gmail-item');
        const labelEl = item.querySelector('.suggestion-label');
        const suggestionText = labelEl ? labelEl.textContent.trim() : '';
        const typed = typedText || '';
        const isTypedTextItem = suggestionText.toLowerCase() === typed.toLowerCase();
        
        if (isGmailItem) {
            searchInput.value = '';
        } else if (item.classList.contains('firefox-suggest-item')) {
            searchInput.value = typed || '';
            searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        } else if (suggestionText && !isTypedTextItem) {
            const typedLen = typed.length;
            searchInput.value = suggestionText.toLowerCase();
            if (typedLen > 0 && suggestionText.toLowerCase().startsWith(typed.toLowerCase())) {
                searchInput.setSelectionRange(typedLen, suggestionText.length);
            } else {
                searchInput.setSelectionRange(0, suggestionText.length);
            }
        } else if (isTypedTextItem && typed) {
            searchInput.value = typed;
            searchInput.setSelectionRange(typed.length, typed.length);
        }
    }
    
    function updateSelectedSuggestion(isKeyboardNavigation = false) {
        if (!suggestionsList) return;
        
        if (isKeyboardNavigation) {
            suggestionsList.classList.add('keyboard-navigating');
        } else {
            suggestionsList.classList.remove('keyboard-navigating');
        }
        
        const suggestionsContent = suggestionsList.querySelector('.suggestions-content');
        if (!suggestionsContent) return;
        
        const items = suggestionsContent.querySelectorAll('.suggestion-item:not(.skeleton):not(.gmail-item-hidden)');
        const navigableItems = Array.from(items);
        
        navigableItems.forEach((item) => {
            item.classList.remove('is-selected');
            const separator = item.querySelector('.suggestion-separator');
            const hintText = item.querySelector('.suggestion-hint-text');
            if (separator && !item.classList.contains('firefox-suggest-item')) separator.style.removeProperty('display');
            if (hintText && !item.classList.contains('firefox-suggest-item')) hintText.style.removeProperty('display');
        });
        
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < navigableItems.length) {
            const selectedItem = navigableItems[selectedSuggestionIndex];
            selectedItem.classList.add('is-selected');
            const separator = selectedItem.querySelector('.suggestion-separator');
            const hintText = selectedItem.querySelector('.suggestion-hint-text');
            if (separator) separator.style.display = 'block';
            if (hintText) hintText.style.display = 'block';
            
            if (isKeyboardNavigation && searchInput) {
                if (!originalTypedText) originalTypedText = searchInput.value.trim();
                updateSearchInputForItem(selectedItem, originalTypedText);
            }
            
            selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }
    
    // ===== UPDATE SUGGESTIONS FUNCTION =====
    
    function updateSuggestions(suggestions, options = {}) {
        console.log('[UPDATE] ===== updateSuggestions CALLED =====');
        console.log('[UPDATE] Suggestions array:', suggestions);
        console.log('[UPDATE] Suggestions count:', suggestions ? suggestions.length : 0);
        
        if (!suggestionsList) {
            console.log('[UPDATE] ✗ suggestionsList not found, returning early');
            return;
        }
        
        console.log('[UPDATE] ✓ suggestionsList exists, proceeding...');
        
        // Remove any existing skeletons
        removeSkeletons();
        
        // Get the suggestions content container
        const suggestionsContent = suggestionsList.querySelector('.suggestions-content');
        if (!suggestionsContent) {
            console.log('[UPDATE] ✗ suggestions-content not found');
            return;
        }
        
        // Store current displayed suggestions
        currentDisplayedSuggestions = Array.isArray(suggestions) ? [...suggestions] : [];
        
        // Get current search value for the typed text
        const searchValue = searchInput ? searchInput.value : '';
        const searchValueTrimmed = searchValue.trim();
        
        // Hide Gmail when typing so typed text replaces it as first suggestion
        const gmailItem = suggestionsContent.querySelector('.gmail-item');
        if (gmailItem) {
            gmailItem.classList.toggle('gmail-item-hidden', !!searchValueTrimmed);
        }
        
        // Hide 'Your Recent Searches' heading when typing
        const headingItem = suggestionsContent.querySelector('.suggestions-heading');
        if (headingItem) {
            headingItem.classList.toggle('suggestions-heading-hidden', !!searchValueTrimmed);
        }
        
        // Clear existing suggestion items and Firefox Suggest headings (keep Gmail and Your Recent Searches heading)
        const existingItems = suggestionsContent.querySelectorAll('.suggestion-item:not(.gmail-item):not(.skeleton)');
        existingItems.forEach(item => item.remove());
        suggestionsContent.querySelectorAll('.firefox-suggest-section-heading').forEach(h => h.remove());
        
        // Prepend typed text as first suggestion if there's text
        const typedTextInSuggestions = suggestions.some(s => s.toLowerCase() === searchValueTrimmed.toLowerCase());
        const suggestionsToShow = searchValueTrimmed && !typedTextInSuggestions
            ? [searchValueTrimmed, ...suggestions]
            : suggestions;
        
        console.log('[UPDATE] Typed text:', searchValueTrimmed, '| In suggestions?', typedTextInSuggestions);
        console.log('[UPDATE] Total suggestions to show:', suggestionsToShow.length);
        
        // Get Firefox suggestions metadata
        const firefoxSuggestions = suggestions._firefoxSuggestions || [];
        console.log('[UPDATE] Firefox suggestions:', firefoxSuggestions.length);
        
        // Track AI suggestions for icon assignment
        if (suggestions.length > 0) {
            suggestions.forEach(suggestion => {
                const suggestionLower = suggestion.toLowerCase();
                // Don't track if it's a Firefox suggestion
                const isFirefox = firefoxSuggestions.some(fs => 
                    (typeof fs === 'string' && fs.toLowerCase() === suggestionLower) ||
                    (typeof fs === 'object' && fs.title && fs.title.toLowerCase() === suggestionLower)
                );
                if (!isFirefox) {
                    aiSuggestionsSet.add(suggestionLower);
                }
            });
        }
        
        // Build set of Firefox suggestion titles and map title -> full data for lookup
        const firefoxTitlesSet = new Set(
            (firefoxSuggestions || []).map(fs =>
                (typeof fs === 'string' ? fs : (fs && fs.title ? fs.title : '')).toLowerCase()
            ).filter(Boolean)
        );
        const firefoxDataByTitle = new Map(
            (firefoxSuggestions || [])
                .filter(fs => typeof fs === 'object' && fs.title)
                .map(fs => [fs.title.toLowerCase().trim(), fs])
        );
        
        // Firefox type icons: history = clock, bookmark = star, tab = tab
        const firefoxTypeIcons = {
            tab: '<svg class="suggestion-icon firefox-suggest-type-icon" width="16" height="16" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="1" y="2" width="10" height="8" rx="1" stroke="currentColor" stroke-width="1"/><path d="M1 4H11" stroke="currentColor" stroke-width="1"/><circle cx="3" cy="3" r="0.5" fill="currentColor"/><circle cx="5" cy="3" r="0.5" fill="currentColor"/></svg>',
            bookmark: '<svg class="suggestion-icon firefox-suggest-type-icon" width="16" height="16" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 1.2C6.3 2.2 6.6 3.2 7.3 4.4C8.2 4.6 9.4 4.7 10.6 4.9C9.8 6.1 9 7.1 8.3 7.4C8.8 8.8 9.1 9.8 9.2 10.6C7.8 9.8 6.9 9.2 6 8.8C4.1 9.2 3.2 9.8 2.8 10.6C3.1 8.8 3.4 7.8 3.7 7.4C2.8 6.5 2.1 5.5 1.4 4.9C3 5.1 4.1 4.8 4.7 4.4C5.4 3.2 5.7 2.2 6 1.2Z" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
            history: null  // use icons/clock.svg
        };
        
        // Add suggestions
        if (suggestionsToShow && suggestionsToShow.length > 0) {
            console.log('[UPDATE] Adding', suggestionsToShow.length, 'suggestions');
            
            let firefoxHeadingAdded = false;
            
            suggestionsToShow.forEach((suggestion, index) => {
                const isTypedText = index === 0 && searchValueTrimmed && suggestion.toLowerCase() === searchValueTrimmed.toLowerCase();
                const isFirefoxSuggest = firefoxTitlesSet.has((suggestion || '').toLowerCase().trim());
                
                // Add 'Firefox Suggest' heading before first Firefox item
                if (isFirefoxSuggest && !firefoxHeadingAdded) {
                    const headingLi = document.createElement('li');
                    headingLi.className = 'firefox-suggest-section-heading';
                    headingLi.textContent = 'Firefox Suggest';
                    suggestionsContent.appendChild(headingLi);
                    firefoxHeadingAdded = true;
                }
                
                // Create suggestion item
                const li = document.createElement('li');
                li.className = 'suggestion-item' + (isFirefoxSuggest ? ' firefox-suggest-item' : '');
                if (isTypedText) {
                    li.setAttribute('data-typed-text', 'true');
                }
                
                // Get appropriate icon (Firefox items: history=clock, bookmark=star, tab=tab)
                let iconEl;
                if (isFirefoxSuggest) {
                    const firefoxData = firefoxDataByTitle.get((suggestion || '').toLowerCase().trim());
                    const firefoxType = (firefoxData && firefoxData.type) ? firefoxData.type : 'history';
                    const iconSvg = firefoxTypeIcons[firefoxType];
                    if (firefoxType === 'history' || !iconSvg) {
                        iconEl = document.createElement('img');
                        iconEl.src = 'icons/clock.svg';
                        iconEl.alt = '';
                        iconEl.className = 'suggestion-icon';
                    } else {
                        iconEl = document.createElement('span');
                        iconEl.innerHTML = iconSvg;
                        iconEl.className = 'suggestion-icon-wrapper';
                    }
                } else {
                    const iconSrc = getIconForSuggestion(suggestion);
                    iconEl = document.createElement('img');
                    iconEl.src = iconSrc;
                    iconEl.alt = '';
                    iconEl.className = 'suggestion-icon';
                }
                
                // Add label with highlighting
                const label = document.createElement('span');
                label.className = 'suggestion-label';
                
                const isGmailSuggestion = false; // Gmail item is separate
                const highlightedText = highlightMatchingText(suggestion, searchValueTrimmed, isTypedText, isGmailSuggestion);
                label.innerHTML = highlightedText;
                
                // Add separator and hint (wrap in hint-area for Firefox to allow truncate+fade)
                const separator = document.createElement('span');
                separator.className = 'suggestion-separator';
                separator.textContent = '•';
                
                const hintText = document.createElement('span');
                hintText.className = 'suggestion-hint-text';
                if (isFirefoxSuggest) {
                    const firefoxData = firefoxDataByTitle.get((suggestion || '').toLowerCase().trim());
                    const dateIso = firefoxData && firefoxData.date;
                    const firefoxType = (firefoxData && firefoxData.type) ? firefoxData.type : 'history';
                    const urlDisplay = firefoxData && firefoxData.url
                        ? (firefoxData.url || '').replace(/^www\./i, '').toLowerCase()
                        : '';
                    const isTab = firefoxType === 'tab';
                    const defaultContent = isTab ? 'switch-to-tab' : (urlDisplay || '');
                    if (dateIso && (defaultContent || urlDisplay)) {
                        const fullStr = getRelativeDateString(dateIso, firefoxType);
                        const prefixes = { history: 'You visited this page ', bookmark: 'You bookmarked this page ', tab: 'You opened this page ' };
                        const prefix = prefixes[firefoxType] || prefixes.history;
                        const relativeDatePart = fullStr.slice(prefix.length);
                        const actualDatePart = getActualDateString(dateIso);
                        const defaultPart = document.createElement('span');
                        defaultPart.className = 'suggestion-hint-default-part';
                        if (isTab) {
                            const switchBtn = document.createElement('button');
                            switchBtn.type = 'button';
                            switchBtn.className = 'firefox-switch-tab-button';
                            switchBtn.textContent = 'Switch to Tab';
                            switchBtn.addEventListener('mousedown', (e) => e.preventDefault());
                            defaultPart.appendChild(switchBtn);
                        } else {
                            defaultPart.textContent = urlDisplay;
                        }
                        const dateHintPart = document.createElement('span');
                        dateHintPart.className = 'suggestion-hint-date-hint-part';
                        dateHintPart.style.display = 'none';
                        dateHintPart.appendChild(document.createTextNode(prefix));
                        const datePartSpan = document.createElement('span');
                        datePartSpan.className = 'suggestion-hint-date-part';
                        datePartSpan.textContent = relativeDatePart;
                        datePartSpan.addEventListener('mouseenter', () => { datePartSpan.textContent = actualDatePart; });
                        datePartSpan.addEventListener('mouseleave', () => { datePartSpan.textContent = relativeDatePart; });
                        dateHintPart.appendChild(datePartSpan);
                        hintText.appendChild(defaultPart);
                        hintText.appendChild(dateHintPart);
                        li.addEventListener('mouseenter', () => {
                            defaultPart.style.display = 'none';
                            dateHintPart.style.display = 'inline';
                        });
                        li.addEventListener('mouseleave', () => {
                            defaultPart.style.display = 'inline';
                            dateHintPart.style.display = 'none';
                        });
                    } else if (urlDisplay) {
                        hintText.textContent = urlDisplay;
                    } else {
                        hintText.textContent = 'Search with Google';
                    }
                }
                
                li.appendChild(iconEl);
                li.appendChild(label);
                if (isFirefoxSuggest) {
                    const hintArea = document.createElement('span');
                    hintArea.className = 'suggestion-hint-area';
                    hintArea.appendChild(separator);
                    hintArea.appendChild(hintText);
                    li.appendChild(hintArea);
                } else {
                    li.appendChild(separator);
                    li.appendChild(hintText);
                }
                
                // Add click handler to save to history
                li.addEventListener('click', () => {
                    console.log('[CLICK] Suggestion clicked:', suggestion);
                    saveToSearchHistory(suggestion);
                });
                
                // Append to content
                suggestionsContent.appendChild(li);
            });
            
            console.log('[UPDATE] Added', suggestionsToShow.length, 'suggestion items to list');
        } else {
            console.log('[UPDATE] No suggestions to add');
        }
        
        // Re-attach event listeners for first hover
        suggestionItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                if (!firstHoverDone && suggestionsList.classList.contains('first-hover-fade')) {
                    firstHoverDone = true;
                    suggestionsList.classList.remove('first-hover-fade');
                }
            }, { once: false });
        });
        
        // Set keyboard selection index when suggestions change
        selectedSuggestionIndex = searchValueTrimmed ? 0 : -1;
        lastTypedTextInInput = searchValueTrimmed || '';
        lastHoveredItemForInput = null;
        updateSelectedSuggestion(false);
        
        // Suppress hover until mouse moves to a new item (e.g. when AI suggestions return)
        if (options.suppressHover && suggestionsList) {
            suggestionsList.classList.add('suggestions-suppress-hover');
        } else if (suggestionsList) {
            suggestionsList.classList.remove('suggestions-suppress-hover');
        }
    }
    
    // ===== CLEAR BUTTON =====
    
    function updateClearButton() {
        if (searchClearButton && searchInput) {
            if (searchInput.value.trim().length > 0) {
                searchClearButton.style.display = 'flex';
            } else {
                searchClearButton.style.display = 'none';
            }
        }
    }
    
    if (searchClearButton && searchInput) {
        searchClearButton.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent input from blurring
        });
        
        searchClearButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[CLEAR] Clear button clicked');
            
            // Clear the input value
            searchInput.value = '';
            searchClearButton.style.display = 'none';
            
            // Reset to default suggestions
            const defaultSuggestions = ['hoka', '13 in macbook air', 'coffee machines for sale', 'taylor swift', 'coffee grinder'];
            updateSuggestions(defaultSuggestions);
            currentDisplayedSuggestions = defaultSuggestions;
            
            // Keep focus on input (keeps panel open)
            searchInput.focus();
        });
    }
    
    // ===== INPUT EVENT HANDLER =====
    if (searchInput) {
        searchInput.addEventListener('input', async (event) => {
            originalTypedText = ''; // Reset so next keyboard nav captures current typed text
            updateClearButton();
            console.log('[INPUT] ===== INPUT EVENT STARTED =====');
            
            const value = (event.target.value || '').toString();
            const valueLower = value.toLowerCase().trim();
            console.log('[INPUT] Raw value:', value, '| Trimmed lower:', valueLower, '| Length:', valueLower.length);
            
            // Handle empty field - show default suggestions
            if (valueLower.length === 0) {
                console.log('[INPUT] Empty field, showing default suggestions');
                const defaultSuggestions = ['hoka', '13 in macbook air', 'coffee machines for sale', 'taylor swift', 'coffee grinder'];
                updateSuggestions(defaultSuggestions);
                currentDisplayedSuggestions = defaultSuggestions;
                return;
            }
            
            // For 1 character - look for all 2-char keys starting with that character
            if (valueLower.length === 1) {
                console.log('[INPUT] Branch: length === 1');
                const matchingSuggestions = [];
                
                if (typeof suggestionWords !== 'undefined' && suggestionWords) {
                    console.log('[INPUT] suggestionWords available, searching keys...');
                    Object.keys(suggestionWords).forEach(key => {
                        if (key.startsWith(valueLower)) {
                            matchingSuggestions.push(...suggestionWords[key]);
                        }
                    });
                    console.log('[INPUT] Found', matchingSuggestions.length, 'matching suggestions');
                    
                    if (matchingSuggestions.length > 0) {
                        const suggestionsToShow = matchingSuggestions.slice(0, 9);
                        console.log('[INPUT] Updating with local suggestions:', suggestionsToShow);
                        updateSuggestions(suggestionsToShow);
                        currentDisplayedSuggestions = suggestionsToShow;
                        return;
                    }
                } else {
                    console.log('[INPUT] suggestionWords not available');
                }
            }
            
            // For 2 characters - use exact match
            if (valueLower.length === 2) {
                console.log('[INPUT] Branch: length === 2');
                
                if (typeof suggestionWords !== 'undefined' && suggestionWords && suggestionWords[valueLower]) {
                    console.log('[INPUT] Found exact match for', valueLower);
                    const suggestionsToShow = suggestionWords[valueLower];
                    updateSuggestions(suggestionsToShow);
                    currentDisplayedSuggestions = suggestionsToShow;
                    console.log('[INPUT] Returning early from length === 2 branch');
                    return;
                } else {
                    console.log('[INPUT] No exact match found for:', valueLower);
                }
            }
            
            // For 3+ characters, fetch from AI
            if (valueLower.length >= 3) {
                console.log('[INPUT] ===== Branch: length >= 3 =====');
                console.log('[INPUT] Query:', valueLower, '| Length:', valueLower.length);
                
                // Check if we have existing suggestions to filter
                const hasExistingSuggestions = currentDisplayedSuggestions.length > 0;
                console.log('[INPUT] Has existing suggestions:', hasExistingSuggestions, 'count:', currentDisplayedSuggestions.length);
                
                if (hasExistingSuggestions) {
                    // Filter existing suggestions
                    console.log('[INPUT] Filtering existing suggestions for query:', valueLower);
                    const filteredSuggestions = filterExistingSuggestions(valueLower);
                    console.log('[INPUT] Filtered suggestions count:', filteredSuggestions.length);
                } else {
                    // Show skeletons while waiting for AI
                    console.log('[INPUT] No existing suggestions, showing skeletons');
                    updateSuggestions([]);
                    showSkeletonLoaders(9);
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
                            updateSuggestions(aiSuggestions, { suppressHover: true });
                            currentDisplayedSuggestions = aiSuggestions;
                        } else {
                            console.log('[AI] No AI suggestions returned');
                            updateSuggestions([]);
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
    
    // Keyboard navigation (ArrowUp, ArrowDown, Enter)
    if (searchInput && suggestionsList) {
        searchInput.addEventListener('keydown', (event) => {
            if (!suggestionsList) return;
            const suggestionsContent = suggestionsList.querySelector('.suggestions-content');
            if (!suggestionsContent) return;
            
            const items = suggestionsContent.querySelectorAll('.suggestion-item:not(.skeleton):not(.gmail-item-hidden)');
            const navigableItems = Array.from(items);
            const count = navigableItems.length;
            if (count === 0) return;
            
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                const startIndex = selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : (hoveredSuggestionIndex >= 0 ? hoveredSuggestionIndex : -1);
                if (startIndex < 0) {
                    selectedSuggestionIndex = 0;
                } else {
                    selectedSuggestionIndex = (startIndex + 1) % count;
                }
                updateSelectedSuggestion(true);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                const startIndex = selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : (hoveredSuggestionIndex >= 0 ? hoveredSuggestionIndex : -1);
                if (startIndex < 0) {
                    selectedSuggestionIndex = count - 1;
                } else {
                    selectedSuggestionIndex = startIndex <= 0 ? count - 1 : startIndex - 1;
                }
                updateSelectedSuggestion(true);
            } else if (event.key === 'Enter' && selectedSuggestionIndex >= 0) {
                event.preventDefault();
                const searchText = searchInput.value.trim();
                if (searchText) {
                    saveToSearchHistory(searchText);
                    window.open('https://www.google.com/search?q=' + encodeURIComponent(searchText), '_blank');
                }
            }
        });
    }
    
    // Clear keyboard-navigating when mouse moves over suggestions
    if (suggestionsList) {
        suggestionsList.addEventListener('mousemove', () => {
            if (suggestionsList.classList.contains('keyboard-navigating')) {
                suggestionsList.classList.remove('keyboard-navigating');
                selectedSuggestionIndex = -1;
                updateSelectedSuggestion(false);
            }
            if (suggestionsList.classList.contains('suggestions-suppress-hover')) {
                suggestionsList.classList.remove('suggestions-suppress-hover');
                selectedSuggestionIndex = -1;
                updateSelectedSuggestion(false);
            }
        });
        
        // Track hovered item index and update search input (like keyboard nav)
        suggestionsList.addEventListener('mouseover', (e) => {
            const item = e.target.closest('.suggestion-item:not(.skeleton):not(.gmail-item-hidden)');
            if (item) {
                const suggestionsContent = suggestionsList.querySelector('.suggestions-content');
                if (suggestionsContent) {
                    const items = suggestionsContent.querySelectorAll('.suggestion-item:not(.skeleton):not(.gmail-item-hidden)');
                    const idx = Array.from(items).indexOf(item);
                    if (idx >= 0) hoveredSuggestionIndex = idx;
                }
                if (item !== lastHoveredItemForInput && !suggestionsList.classList.contains('keyboard-navigating')) {
                    lastHoveredItemForInput = item;
                    updateSearchInputForItem(item, lastTypedTextInInput);
                }
            }
        });
        suggestionsList.addEventListener('mouseout', (e) => {
            if (!suggestionsList.contains(e.relatedTarget)) {
                hoveredSuggestionIndex = -1;
                lastHoveredItemForInput = null;
                if (searchInput && lastTypedTextInInput !== undefined) {
                    searchInput.value = lastTypedTextInInput;
                    searchInput.setSelectionRange(lastTypedTextInInput.length, lastTypedTextInInput.length);
                }
            }
        });
    }
    
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
