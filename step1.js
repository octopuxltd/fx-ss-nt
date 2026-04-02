// Step 1 JavaScript

/** Set to true to enable verbose `[default-badge]` logs (insert badge, abort reasons, etc.) */
const DEBUG_DEFAULT_BADGE = false;
/** Set to false to silence badge drag logs (mousedown, drag move/end, applied default). On by default. */
const DEBUG_DEFAULT_BADGE_DRAG = true;
function defaultBadgeLog(...args) {
    if (!DEBUG_DEFAULT_BADGE) return;
    console.log('[default-badge]', ...args);
}
function defaultBadgeDragLog(...args) {
    if (!DEBUG_DEFAULT_BADGE_DRAG) return;
    console.log('[default-badge]', ...args);
}

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
    const prefixes = { history: 'You visited this page ', bookmark: 'You bookmarked this page ', tab: 'You opened this page ', actions: 'You opened this page ' };
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
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.getFullYear() === yesterday.getFullYear() &&
        d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate();
    if (isToday) {
        const hours = d.getHours();
        const mins = d.getMinutes();
        const ampm = hours >= 12 ? 'pm' : 'am';
        const h12 = hours % 12 || 12;
        const minsPadded = mins < 10 ? '0' + mins : mins;
        return `at ${h12}.${minsPadded}${ampm}`;
    }
    if (isYesterday) {
        return 'yesterday';
    }
    const day = d.getDate();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `on ${day} ${month} ${year}`;
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

/** Main page / New Tab row (legacy key, unchanged). */
const DEFAULT_SEARCH_ENGINE_KEY_MAIN = 'default_search_engine';
const DEFAULT_SEARCH_ENGINE_KEY_ADDRESSBAR = 'default_search_engine:addressbar';
const DEFAULT_SEARCH_ENGINE_KEY_STANDALONE = 'default_search_engine:standalone';

/**
 * Read default-engine keys: prefer top `localStorage` in iframes when accessible.
 * Writes use `setDefaultSearchEngineStorageItem` — opaque `file://` iframes often cannot access
 * `top.localStorage`, so the parent applies writes via `postMessage` and mirrors back.
 */
function getDefaultSearchEngineLocalStorage() {
    try {
        if (typeof window !== 'undefined' && window.top && window.top !== window) {
            return window.top.localStorage;
        }
    } catch (_) {
        /* cross-origin top */
    }
    return localStorage;
}

/**
 * Authoritative persistence for the three default-engine keys. Embedded iframes postMessage the parent;
 * the parent writes `localStorage` and mirrors the key/value back so iframe reads work without top access.
 */
function setDefaultSearchEngineStorageItem(key, value) {
    const v = String(value);
    if (
        key !== DEFAULT_SEARCH_ENGINE_KEY_MAIN &&
        key !== DEFAULT_SEARCH_ENGINE_KEY_ADDRESSBAR &&
        key !== DEFAULT_SEARCH_ENGINE_KEY_STANDALONE
    ) {
        return;
    }
    if (window !== window.top) {
        try {
            window.parent.postMessage({ type: 'set-default-search-engine', key, value: v }, '*');
        } catch (_) {}
        return;
    }
    try {
        localStorage.setItem(key, v);
    } catch (_) {}
}

/** Parent → iframe: copy parent’s three engine keys so iframe `localStorage` stays in sync for reads. */
function pushDefaultSearchEngineKeysToIframe(contentWindow) {
    if (!contentWindow || typeof window === 'undefined' || window !== window.top) return;
    try {
        const keys = {
            [DEFAULT_SEARCH_ENGINE_KEY_MAIN]: localStorage.getItem(DEFAULT_SEARCH_ENGINE_KEY_MAIN),
            [DEFAULT_SEARCH_ENGINE_KEY_ADDRESSBAR]: localStorage.getItem(DEFAULT_SEARCH_ENGINE_KEY_ADDRESSBAR),
            [DEFAULT_SEARCH_ENGINE_KEY_STANDALONE]: localStorage.getItem(DEFAULT_SEARCH_ENGINE_KEY_STANDALONE),
        };
        contentWindow.postMessage({ type: 'seed-default-search-engine-keys', keys }, '*');
    } catch (_) {}
}

/**
 * Which `localStorage` key backs the current page’s search switcher (main vs address bar iframe vs standalone iframe).
 * Mirrors scope logic used for `search_engines_display:*`.
 */
function getDefaultSearchEngineStorageKeyForPage() {
    const isAddressbar = typeof document !== 'undefined' && document.body?.classList.contains('addressbar');
    const isStandalone = typeof document !== 'undefined' && document.body?.classList.contains('standalone-search-box');
    if (isAddressbar && isStandalone) return DEFAULT_SEARCH_ENGINE_KEY_STANDALONE;
    if (isAddressbar) return DEFAULT_SEARCH_ENGINE_KEY_ADDRESSBAR;
    return DEFAULT_SEARCH_ENGINE_KEY_MAIN;
}

/** Which search UI this document’s switcher controls (for logs). Not the same as storage key string. */
function getDefaultSearchEngineSurfaceLabel() {
    const isAddressbar = document.body?.classList.contains('addressbar');
    const isStandalone = document.body?.classList.contains('standalone-search-box');
    if (isAddressbar && isStandalone) return 'Standalone search box (iframe)';
    if (isAddressbar) return 'Address bar (iframe)';
    return 'New Tab / Homepage (main page)';
}

function getDefaultSearchEngineLabelFromStorage() {
    const ls = getDefaultSearchEngineLocalStorage();
    const key = getDefaultSearchEngineStorageKeyForPage();
    const scoped = ls.getItem(key);
    if (scoped && scoped.trim()) return scoped.trim();
    const main = ls.getItem(DEFAULT_SEARCH_ENGINE_KEY_MAIN);
    if (main && main.trim()) return main.trim();
    return 'Google';
}

function setSearchSettingsEngineSelectValue(id, label) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const v = label && String(label).trim() ? String(label).trim() : 'Google';
    const has = Array.from(sel.options).some((o) => o.value === v);
    sel.value = has ? v : 'Google';
}

/** Iframes share `localStorage` but not `storage` events in the same tab — tell the parent to refresh the search settings matrix if it is open. */
function notifyParentDefaultSearchEngineChanged() {
    if (window === window.parent) return;
    try {
        window.parent.postMessage({ type: 'default-search-engine-changed' }, '*');
    } catch (_) {}
}

/**
 * Search settings matrix: main / address bar / standalone each reflect their scoped switcher.
 * Private window column is not synced (no switcher in this prototype).
 */
let applyingSearchSettingsEngineSelectsSync = false;
function syncSearchSettingsDefaultEngineSelects() {
    applyingSearchSettingsEngineSelectsSync = true;
    try {
        const ls = getDefaultSearchEngineLocalStorage();
        const main = ls.getItem(DEFAULT_SEARCH_ENGINE_KEY_MAIN) || 'Google';
        const addr =
            ls.getItem(DEFAULT_SEARCH_ENGINE_KEY_ADDRESSBAR) || main;
        const standalone =
            ls.getItem(DEFAULT_SEARCH_ENGINE_KEY_STANDALONE) || main;
        setSearchSettingsEngineSelectValue('search-settings-default-engine-new-tab', main);
        setSearchSettingsEngineSelectValue('search-settings-default-engine-address-bar', addr);
        setSearchSettingsEngineSelectValue('search-settings-default-engine-standalone', standalone);
    } finally {
        queueMicrotask(() => {
            applyingSearchSettingsEngineSelectsSync = false;
        });
    }
}

/**
 * Compare switcher pinned row vs storage (and overlay when opt-in). Search settings overlay uses
 * `logSearchSettingsOverlayOpened()` which always logs when that modal opens.
 * Switcher open always logs via `logSearchSwitcherOpenedDefault()`.
 * Extra dump: `localStorage.setItem('debug_search_engine_default_sync', 'true')` then reload.
 */
function getPinnedEngineLabelFromSwitcherButton(buttonEl) {
    if (!buttonEl) return null;
    const pinned = buttonEl.querySelector('.dropdown-search-engines .dropdown-item-pinned');
    const labelEl = pinned?.querySelector('.dropdown-engine-label');
    const t = labelEl?.textContent?.trim();
    return t || null;
}

function getEffectiveSearchDefaultsFromStorage() {
    const ls = getDefaultSearchEngineLocalStorage();
    const mainRaw = ls.getItem(DEFAULT_SEARCH_ENGINE_KEY_MAIN);
    const main = mainRaw && mainRaw.trim() ? mainRaw.trim() : 'Google';
    const addrRaw = ls.getItem(DEFAULT_SEARCH_ENGINE_KEY_ADDRESSBAR);
    const addr = addrRaw && addrRaw.trim() ? addrRaw.trim() : main;
    const standRaw = ls.getItem(DEFAULT_SEARCH_ENGINE_KEY_STANDALONE);
    const standalone = standRaw && standRaw.trim() ? standRaw.trim() : main;
    return { newTab: main, addressBar: addr, standalone };
}

function getSearchSettingsOverlaySelectSnapshot() {
    const selMain = document.getElementById('search-settings-default-engine-new-tab');
    const selAddr = document.getElementById('search-settings-default-engine-address-bar');
    const selStandalone = document.getElementById('search-settings-default-engine-standalone');
    if (!selMain && !selAddr && !selStandalone) return null;
    return {
        newTab: selMain?.value ?? null,
        addressBar: selAddr?.value ?? null,
        standalone: selStandalone?.value ?? null,
    };
}

/** Called after `syncSearchSettingsDefaultEngineSelects()` when the modal opens (main page only). Always logs — not gated by localStorage. */
function logSearchSettingsOverlayOpened() {
    const ls = getDefaultSearchEngineLocalStorage();
    const rawMain = ls.getItem(DEFAULT_SEARCH_ENGINE_KEY_MAIN);
    const rawAddr = ls.getItem(DEFAULT_SEARCH_ENGINE_KEY_ADDRESSBAR);
    const rawStandalone = ls.getItem(DEFAULT_SEARCH_ENGINE_KEY_STANDALONE);
    const matrix = getEffectiveSearchDefaultsFromStorage();
    const selects = getSearchSettingsOverlaySelectSnapshot();
    const fmt = (v) => (v === null || v === undefined ? '(unset)' : `"${String(v)}"`);
    // Plain strings so DevTools does not collapse the important values.
    console.log(
        '[search-settings] overlay opened — <select> values (three independent localStorage keys; unset scoped keys fall back to main): ' +
            `Address bar="${selects?.addressBar ?? '?'}" | ` +
            `New tab/homepage="${selects?.newTab ?? '?'}" | ` +
            `Standalone="${selects?.standalone ?? '?'}"`
    );
    console.log(
        '[search-settings] localStorage raw: ' +
            `default_search_engine=${fmt(rawMain)}; ` +
            `default_search_engine:addressbar=${fmt(rawAddr)}; ` +
            `default_search_engine:standalone=${fmt(rawStandalone)}`
    );
    console.log(
        '[search-settings] resolved matrix (same rules as sync: scoped value or fallback to main): ' +
            `newTab=${matrix.newTab}, addressBar=${matrix.addressBar}, standalone=${matrix.standalone}`
    );
    if (selects && matrix) {
        if (
            selects.newTab !== matrix.newTab ||
            selects.addressBar !== matrix.addressBar ||
            selects.standalone !== matrix.standalone
        ) {
            console.warn('[search-settings] <select> values ≠ resolved matrix (invalid option or sync bug)', { selects, matrix });
        }
    }
}

/** Search settings matrix: log when a default-engine `<select>` changes (main page only). */
function logSearchSettingsEngineSelectChanged(columnLabel, value) {
    console.log('[search-settings] default engine changed via dropdown: ' + columnLabel + ' → "' + value + '"');
}

/** Logs whenever a search engine switcher opens (main page or iframe). Not gated by localStorage. */
function logSearchSwitcherOpenedDefault(searchSwitcherButton) {
    const surface = getDefaultSearchEngineSurfaceLabel();
    const key = getDefaultSearchEngineStorageKeyForPage();
    const pinnedLabel = getPinnedEngineLabelFromSwitcherButton(searchSwitcherButton);
    const storageLabel = getDefaultSearchEngineLabelFromStorage();
    console.log(
        '[search-switcher] opened — default for this search: pinned row="' +
            (pinnedLabel ?? '(none)') +
            '", storage-backed="' +
            storageLabel +
            '" | surface=' +
            surface +
            ' | localStorage key=' +
            key
    );
    if (pinnedLabel != null && storageLabel != null && pinnedLabel !== storageLabel) {
        console.warn('[search-switcher] pinned row ≠ storage-backed default for this surface', {
            pinnedLabel,
            storageLabel,
        });
    }
}

function logSearchEngineDefaultSync(trigger, searchSwitcherButton) {
    try {
        if (typeof localStorage === 'undefined' || localStorage.getItem('debug_search_engine_default_sync') !== 'true') {
            return;
        }
    } catch (_) {
        return;
    }
    const surface =
        document.body?.classList.contains('addressbar') && document.body?.classList.contains('standalone-search-box')
            ? 'standalone-iframe'
            : document.body?.classList.contains('addressbar')
              ? 'address-bar-iframe'
              : 'main-html';
    const keyForPage = getDefaultSearchEngineStorageKeyForPage();
    const ls = getDefaultSearchEngineLocalStorage();
    const raw = {
        [DEFAULT_SEARCH_ENGINE_KEY_MAIN]: ls.getItem(DEFAULT_SEARCH_ENGINE_KEY_MAIN),
        [DEFAULT_SEARCH_ENGINE_KEY_ADDRESSBAR]: ls.getItem(DEFAULT_SEARCH_ENGINE_KEY_ADDRESSBAR),
        [DEFAULT_SEARCH_ENGINE_KEY_STANDALONE]: ls.getItem(DEFAULT_SEARCH_ENGINE_KEY_STANDALONE),
    };
    const matrix = getEffectiveSearchDefaultsFromStorage();
    const thisPageFromStorage = getDefaultSearchEngineLabelFromStorage();
    const domPinned = getPinnedEngineLabelFromSwitcherButton(searchSwitcherButton);
    const overlay = getSearchSettingsOverlaySelectSnapshot();
    const payload = {
        trigger,
        surface,
        storageKeyForThisPage: keyForPage,
        localStorageRaw: raw,
        effectiveDefaults_fromLocalStorage: matrix,
        thisPageEffective_fromStorage: thisPageFromStorage,
        domPinnedRow_inThisSwitcher: domPinned,
        searchSettingsOverlay_selects: overlay,
    };
    console.log('[search-engine-default-sync]', payload);
    if (domPinned != null && thisPageFromStorage != null && domPinned !== thisPageFromStorage) {
        console.warn('[search-engine-default-sync] pinned row in open switcher ≠ this page’s storage-backed default', {
            domPinned,
            thisPageFromStorage,
        });
    }
    if (overlay) {
        const m = matrix;
        if (
            overlay.newTab !== m.newTab ||
            overlay.addressBar !== m.addressBar ||
            overlay.standalone !== m.standalone
        ) {
            console.warn('[search-engine-default-sync] Search settings dropdowns ≠ localStorage matrix (after sync)', {
                overlay,
                matrix,
            });
        }
    }
}

const SEARCH_ENGINE_ORDER_KEY = 'search_engine_order';
const FIREFOX_SUGGESTIONS_ENABLED_KEY = 'firefox_suggestions_enabled';
const PIN_DEFAULT_SEARCH_ENGINE_ENABLED_KEY = 'pin_default_search_engine_enabled';
const STANDALONE_SEARCH_BOX_VISIBLE_KEY = 'standalone_search_box_visible';
const BACKGROUND_SWATCH_KEY = 'background_swatch';
/** Default when no stored preference (matches step1.html swatches + reset prototype). */
const DEFAULT_BACKGROUND_SWATCH = 'grey';
const SEARCH_BORDER_COLOR_KEY = 'search_border_color';
const SEARCH_BORDER_COLOR_DEFAULT = '#BBA0FF';
const SEARCH_BORDER_BLACK_20 = 'rgba(0, 0, 0, 0.2)';
const SEARCH_BORDER_COLORS = ['#BBA0FF', '#FF8D5B', SEARCH_BORDER_BLACK_20];
/** Matches `step1.html` default order (Google remains `.dropdown-item-pinned`). */
const DEFAULT_MAIN_PAGE_ENGINE_ORDER = [
    'Amazon', 'Bing', 'DuckDuckGo', 'Ecosia', 'eBay', 'Google',
    'IMDb', 'Perplexity', 'Reddit', 'Startpage', 'Wikipedia (en)', 'YouTube'
];

function normalizeSearchBorderColorInput(raw) {
    const t = (raw || '').trim();
    if (!t) return null;
    const tl = t.toLowerCase();
    if (tl === '#ebe8ee') return SEARCH_BORDER_BLACK_20;
    if (tl.replace(/\s/g, '') === 'rgba(0,0,0,0.2)') return SEARCH_BORDER_BLACK_20;
    const hexHit = SEARCH_BORDER_COLORS.filter(c => c.startsWith('#')).find(c => c.toLowerCase() === tl);
    if (hexHit) return hexHit;
    return null;
}

function canonicalSearchBorderColor(raw) {
    return normalizeSearchBorderColorInput(raw) || SEARCH_BORDER_COLOR_DEFAULT;
}

function getStoredSearchBorderColor() {
    const raw = localStorage.getItem(SEARCH_BORDER_COLOR_KEY);
    const fromStorage = raw ? normalizeSearchBorderColorInput(raw) : null;
    if (fromStorage) return fromStorage;
    if (localStorage.getItem('gradient_search_border_enabled') === 'false') {
        return SEARCH_BORDER_BLACK_20;
    }
    return SEARCH_BORDER_COLOR_DEFAULT;
}

function applySearchBorderColorVariable(hex) {
    const c = canonicalSearchBorderColor(hex);
    document.documentElement.style.setProperty('--search-border-ring-color', c);
    return c;
}
const QUICK_BUTTONS_VISIBLE_KEY = 'quick_buttons_visible';
const UNDERLINE_SEARCH_ENGINES_ENABLED_KEY = 'underline_search_engines_enabled';
const KEYBOARD_SWITCHER_NUMBERS_ENABLED_KEY = 'keyboard_switcher_numbers_enabled';
const SEARCH_ENGINES_DISPLAY_KEY_PREFIX = 'search_engines_display';
const TWELVE_SEARCH_ENGINES_ENABLED_KEY = 'twelve_search_engines_enabled';
const SWITCHER_OUTSIDE_SEARCH_BOX_ENABLED_KEY = 'switcher_outside_search_box_enabled';
const SEARCH_ENGINE_LIST_MODE_KEY = 'search_engine_list_mode';

const initialReducedMotion = localStorage.getItem('reduced_motion_enabled');

/**
 * Search switcher close animation: the dropdown collapses with `max-height` (~550ms when not reduced motion;
 * open uses 250ms). Removing
 * `.open` immediately reapplies the full pill border-radius on the button while the panel is
 * still visible, so the bottom corners look wrong. Class `.switcher-closing` keeps the same
 * flat-bottom "tab" shape as `.open` until the dropdown fires `transitionend` for `max-height`
 * (or a timeout). Call this whenever `.open` is cleared while the dropdown may still be
 * animating — not only in pinned-outside mode; gating on that mode left the default inline
 * switcher broken. Future changes: do not remove this coordination or the CSS for
 * `.switcher-closing` without re-testing the close transition.
 */
function beginSwitcherClosingShapeHoldUntilDropdownAnimation(button) {
    if (!button) return;
    const dropdown = button.querySelector('.search-switcher-dropdown');
    /* Click path adds this before .open is removed; other paths call us while still open. */
    if (button.classList.contains('open')) {
        dropdown?.classList.add('switcher-dropdown--closing');
    }
    button.classList.add('switcher-closing');
    let cleanedUp = false;
    const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        button.classList.remove('switcher-closing');
        dropdown?.classList.remove('switcher-dropdown--closing');
        if (dropdown) dropdown.removeEventListener('transitionend', onClosed);
    };
    const onClosed = (ev) => {
        if (ev.propertyName !== 'max-height') return;
        cleanup();
    };
    if (dropdown) dropdown.addEventListener('transitionend', onClosed);
    const closeMs = document.body.classList.contains('reduced-motion') ? 0 : 560;
    setTimeout(cleanup, closeMs);
}

document.addEventListener('DOMContentLoaded', () => {
    let underlineSearchEnginesEnabled = localStorage.getItem(UNDERLINE_SEARCH_ENGINES_ENABLED_KEY) === 'true';
    const keyboardSwitcherNumbersEnabled = localStorage.getItem(KEYBOARD_SWITCHER_NUMBERS_ENABLED_KEY) !== 'false';
    document.body.classList.toggle('keyboard-switcher-numbers-enabled', keyboardSwitcherNumbersEnabled);
    const getSearchEnginesDisplayKey = () => {
        // Per-search-bar preference:
        // - main page search bar
        // - address bar iframe
        // - standalone search box iframe
        const isAddressbar = document.body.classList.contains('addressbar');
        const isStandalone = document.body.classList.contains('standalone-search-box');
        const scope = isAddressbar && isStandalone ? 'standalone' : (isAddressbar ? 'addressbar' : 'main');
        return `${SEARCH_ENGINES_DISPLAY_KEY_PREFIX}:${scope}`;
    };
    const getSearchEnginesDisplayMode = () =>
        localStorage.getItem(getSearchEnginesDisplayKey()) === 'grid' ? 'grid' : 'list';
    let parentViewportInfo = null; // { viewportH: number, frameTop: number } sent by parent when in iframe
    const ensureGridIconTooltips = () => {
        if (!document.body.classList.contains('search-engines-display-grid')) return;
        const container = document.querySelector('.search-switcher-button');
        if (!container) return;

        const enginesContainer = container.querySelector('.dropdown-search-engines');
        if (enginesContainer) {
            enginesContainer.querySelectorAll('.dropdown-item').forEach(item => {
                if (!item.querySelector('.dropdown-engine-icon')) return;
                const label = getEngineLabel(item);
                if (label) item.title = label;
            });
        }

        const firefoxContainer = container.querySelector('.dropdown-firefox-suggestions');
        if (firefoxContainer) {
            firefoxContainer.querySelectorAll('.dropdown-item-firefox-suggestion').forEach(item => {
                const textEl = item.querySelector('span');
                const label = (textEl?.textContent || '').trim();
                if (label) item.title = label;
            });
        }
    };
    const clearGridIconTooltips = () => {
        const container = document.querySelector('.search-switcher-button');
        if (!container) return;
        container.querySelectorAll('.dropdown-search-engines .dropdown-item[title]').forEach(item => {
            // Only clear tooltips that we add for icon-only grid.
            item.removeAttribute('title');
        });
        container.querySelectorAll('.dropdown-firefox-suggestions .dropdown-item-firefox-suggestion[title]').forEach(item => {
            item.removeAttribute('title');
        });
    };
    const applySearchEnginesDisplayMode = (mode) => {
        const normalized = mode === 'grid' ? 'grid' : 'list';
        document.body.classList.toggle('search-engines-display-grid', normalized === 'grid');

        const select = document.getElementById('search-engines-display-select');
        if (select) select.value = normalized;

        const toggle = document.getElementById('search-engines-display-toggle');
        if (toggle) {
            const listSeg = toggle.querySelector('.search-engines-display-segment[data-mode="list"]');
            const gridSeg = toggle.querySelector('.search-engines-display-segment[data-mode="grid"]');
            if (listSeg && gridSeg) {
                const grid = normalized === 'grid';
                listSeg.classList.toggle('search-engines-display-segment--active', !grid);
                gridSeg.classList.toggle('search-engines-display-segment--active', grid);
                listSeg.setAttribute('aria-pressed', grid ? 'false' : 'true');
                gridSeg.setAttribute('aria-pressed', grid ? 'true' : 'false');
            }
        }
        if (normalized === 'grid') {
            ensureGridIconTooltips();
        } else {
            clearGridIconTooltips();
        }
        requestAnimationFrame(() => syncSearchSwitcherDropdownWidth());
    };
    applySearchEnginesDisplayMode(getSearchEnginesDisplayMode());
    const isUnderlineSearchEnginesEnabled = () => {
        const checkbox = document.querySelector('.underline-search-engines-checkbox');
        if (checkbox) return checkbox.checked;
        return underlineSearchEnginesEnabled;
    };

    // Address bar iframe: parent sets width (matches ~62% / 620px cap); iframe reports height (including dropdown)
    if (window !== window.top) {
        window.addEventListener('message', (e) => {
            if (e.data?.type === 'search-border-color') {
                const col = e.data.color;
                if (typeof col === 'string' && normalizeSearchBorderColorInput(col)) {
                    applySearchBorderColorVariable(col);
                }
            } else if (e.data?.type === 'prototype-panel-interaction') {
                window.__prototypeOptionsBlurSuppressUntil = Date.now() + 800;
            } else if (e.data?.type === 'reduced-motion') {
                if (e.data.enabled) {
                    document.body.classList.add('reduced-motion');
                } else {
                    document.body.classList.remove('reduced-motion');
                }
            } else if (e.data?.type === 'pin-default') {
                if (e.data.enabled) {
                    document.body.classList.add('pin-default-enabled');
                } else {
                    document.body.classList.remove('pin-default-enabled');
                }
                updateDefaultBadge();
            } else if (e.data?.type === 'twelve-search-engines') {
                applySearchEnginesCountMode(!!e.data.enabled);
            } else if (e.data?.type === 'underline-search-engines') {
                underlineSearchEnginesEnabled = !!e.data.enabled;
                if (e.data.enabled) {
                    applyEngineInitialUnderlines();
                } else {
                    clearEngineInitialUnderlines();
                }
            } else if (e.data?.type === 'switcher-viewport') {
                const vh = Number(e.data.viewportH);
                const ft = Number(e.data.frameTop);
                if (Number.isFinite(vh) && Number.isFinite(ft)) {
                    parentViewportInfo = { viewportH: vh, frameTop: ft };
                }
            } else if (e.data?.type === 'switcher-keyboard-numbers') {
                document.body.classList.toggle('keyboard-switcher-numbers-enabled', !!e.data.enabled);
            } else if (e.data?.type === 'close-switcher') {
                const btn = document.querySelector('.search-switcher-button');
                const dropdown = btn?.querySelector('.search-switcher-dropdown');
                const container = document.querySelector('.search-container');
                if (btn?.classList.contains('open')) {
                    beginSwitcherClosingShapeHoldUntilDropdownAnimation(btn);
                    forceCloseSearchSwitcherSubPanels();
                    dropdown?.classList.remove('dropdown-revealed');
                    btn.classList.remove('open', 'switcher-opened-by-keyboard', 'switcher-suppress-hover');
                    btn.querySelectorAll('.dropdown-item').forEach(item => item.classList.remove('highlighted'));
                    if (container?.classList.contains('focused')) {
                        if (typeof closeSuggestionsPanel === 'function') {
                            closeSuggestionsPanel();
                        }
                    }
                }
            } else if (e.data?.type === 'mirror-default-search-engine') {
                if (typeof e.data.key === 'string' && typeof e.data.value === 'string') {
                    try {
                        localStorage.setItem(e.data.key, e.data.value);
                    } catch (_) {}
                    queueMicrotask(() => {
                        try {
                            applySearchSwitcherUIFromStoredDefault();
                        } catch (_) {}
                    });
                }
            } else if (e.data?.type === 'seed-default-search-engine-keys' && e.data.keys && typeof e.data.keys === 'object') {
                try {
                    Object.entries(e.data.keys).forEach(([k, v]) => {
                        if (typeof k !== 'string') return;
                        if (v != null && String(v).trim() !== '') {
                            localStorage.setItem(k, String(v));
                        } else {
                            try {
                                localStorage.removeItem(k);
                            } catch (_) {}
                        }
                    });
                } catch (_) {}
                /* Restore runs before parent seeds; iframe localStorage can be stale until this message. */
                queueMicrotask(() => {
                    try {
                        applySearchSwitcherUIFromStoredDefault();
                    } catch (_) {}
                });
            } else if (e.data?.type === 'refresh-search-engine-switcher-from-storage') {
                if (e.data.oldEffectiveDefault !== undefined && e.data.oldEffectiveDefault !== null) {
                    applySearchSwitcherAfterSearchSettingsChange(e.data.oldEffectiveDefault);
                } else {
                    applySearchSwitcherUIFromStoredDefault();
                }
            }
        });
        const reportAddressbarHeight = () => {
            const container = document.querySelector('.search-container');
            if (!container) return;
            const rect = container.getBoundingClientRect();
            let bottom = rect.bottom;
            const switcherButton = container.querySelector('.search-switcher-button');
            const dropdown = switcherButton?.querySelector('.search-switcher-dropdown');
            const dropdownOpen = !!(switcherButton?.classList.contains('open'));
            const dropdownClosing = !!(dropdown?.classList.contains('switcher-dropdown--closing'));
            /* Dropdown is position:absolute — it does not grow .search-container height. When open we add
             * full scrollHeight; when closing, .open is gone immediately but max-height still animates, so
             * we must use the dropdown's current painted rect or the iframe collapses before the panel. */
            if (dropdownOpen && dropdown) {
                const dropdownRect = dropdown.getBoundingClientRect();
                const fullDropdownBottom = dropdownRect.top + dropdown.scrollHeight;
                bottom = Math.max(bottom, fullDropdownBottom);
            } else if (dropdownClosing && dropdown) {
                const dropdownRect = dropdown.getBoundingClientRect();
                if (dropdownRect.height > 0) {
                    bottom = Math.max(bottom, dropdownRect.bottom);
                }
            }

            const h = bottom + 4;
            window.parent.postMessage({ type: 'addressbar-height', height: h }, '*');
        };
        const scheduleHeightReports = () => {
            reportAddressbarHeight();
            requestAnimationFrame(() => {
                reportAddressbarHeight();
                requestAnimationFrame(reportAddressbarHeight);
            });
        };
        reportAddressbarHeight();
        window.addEventListener('resize', reportAddressbarHeight);
        const container = document.querySelector('.search-container');
        if (container && typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(scheduleHeightReports).observe(container);
        }
        if (container) {
            const containerObserver = new MutationObserver((mutations) => {
                if (mutations.some(m => m.attributeName === 'class')) {
                    scheduleHeightReports();
                }
            });
            containerObserver.observe(container, { attributes: true, attributeFilter: ['class'] });
        }
        const switcherButton = container?.querySelector('.search-switcher-button');
        if (switcherButton) {
            const switcherObserver = new MutationObserver(() => {
                if (switcherButton.classList.contains('open')) {
                    scheduleHeightReports();
                } else {
                    const closeDelay = document.body.classList.contains('reduced-motion') ? 0 : 560;
                    setTimeout(scheduleHeightReports, closeDelay);
                }
            });
            switcherObserver.observe(switcherButton, { attributes: true, attributeFilter: ['class'] });
        }
        const switcherDropdownForResize = container?.querySelector('.search-switcher-dropdown');
        if (switcherDropdownForResize) {
            if (typeof ResizeObserver !== 'undefined') {
                new ResizeObserver(scheduleHeightReports).observe(switcherDropdownForResize);
            }
            new MutationObserver(() => scheduleHeightReports()).observe(switcherDropdownForResize, {
                attributes: true,
                attributeFilter: ['class']
            });
        }
    } else {
        const iframe = document.querySelector('.addressbar-iframe');
        const standaloneIframe = document.querySelector('.standalone-search-box-iframe');
        const iframes = [iframe, standaloneIframe].filter(Boolean);
        let addressbarSwitcherOpen = false;
        let standaloneSwitcherOpen = false;
        let lastAddressbarReportedHeight = null;
        let lastStandaloneReportedHeight = null;

        const sendPrototypeOptionsToIframes = () => {
            const searchBorderColor = getStoredSearchBorderColor();
            const reducedMotion = localStorage.getItem('reduced_motion_enabled') === 'true';
            const pinDefault = localStorage.getItem(PIN_DEFAULT_SEARCH_ENGINE_ENABLED_KEY) === 'true';
            const underlineSearchEngines = localStorage.getItem(UNDERLINE_SEARCH_ENGINES_ENABLED_KEY) === 'true';
            const keyboardSwitcherNumbersEnabled = localStorage.getItem(KEYBOARD_SWITCHER_NUMBERS_ENABLED_KEY) !== 'false';
            const twelveSearchEnginesEnabled = localStorage.getItem(TWELVE_SEARCH_ENGINES_ENABLED_KEY) !== 'false';
            const sendViewportToIframe = (iframeEl) => {
                if (!iframeEl?.contentWindow) return;
                try {
                    const r = iframeEl.getBoundingClientRect();
                    iframeEl.contentWindow.postMessage({
                        type: 'switcher-viewport',
                        viewportH: window.innerHeight,
                        frameTop: r.top
                    }, '*');
                } catch (_) {}
            };
            iframes.forEach(f => {
                try {
                    f.contentWindow?.postMessage({ type: 'search-border-color', color: searchBorderColor }, '*');
                    f.contentWindow?.postMessage({ type: 'reduced-motion', enabled: reducedMotion }, '*');
                    f.contentWindow?.postMessage({ type: 'pin-default', enabled: pinDefault }, '*');
                    f.contentWindow?.postMessage({ type: 'underline-search-engines', enabled: underlineSearchEngines }, '*');
                    f.contentWindow?.postMessage({ type: 'switcher-keyboard-numbers', enabled: keyboardSwitcherNumbersEnabled }, '*');
                    f.contentWindow?.postMessage({ type: 'twelve-search-engines', enabled: twelveSearchEnginesEnabled }, '*');
                } catch (_) {}
            });
            if (iframe) sendViewportToIframe(iframe);
            if (standaloneIframe) sendViewportToIframe(standaloneIframe);
            if (iframe) pushDefaultSearchEngineKeysToIframe(iframe.contentWindow);
            if (standaloneIframe) pushDefaultSearchEngineKeysToIframe(standaloneIframe.contentWindow);
        };

        if (iframe) {
            let bandHeightSet = false;
            const updateBandHeight = (h) => {
                if (!bandHeightSet) {
                    bandHeightSet = true;
                    document.documentElement.style.setProperty('--addressbar-band-bar-height', h + 'px');
                }
            };
            const updateIframeSize = () => {
                const w = Math.min(window.innerWidth * 0.62, 620);
                iframe.style.width = w + 'px';
                if (standaloneIframe) {
                    standaloneIframe.style.width = Math.round(w / 2) + 'px';
                }
            };
            const setHeight = (e) => {
                if (e.data?.type === 'addressbar-height' && typeof e.data.height === 'number') {
                    let h = e.data.height;
                    if (e.source === iframe.contentWindow) {
                        lastAddressbarReportedHeight = h;
                        // Clamp to viewport bottom (top window knows its own viewport).
                        try {
                            const r = iframe.getBoundingClientRect();
                            const bottomPadding = 8;
                            const maxAllowed = Math.max(0, Math.floor(window.innerHeight - r.top - bottomPadding));
                            if (addressbarSwitcherOpen) {
                                h = maxAllowed;
                            } else {
                                h = Math.min(h, maxAllowed);
                            }
                        } catch (_) {}
                        iframe.style.height = h + 'px';
                        updateBandHeight(h);
                    } else if (standaloneIframe && e.source === standaloneIframe.contentWindow) {
                        lastStandaloneReportedHeight = h;
                        try {
                            const r = standaloneIframe.getBoundingClientRect();
                            const bottomPadding = 8;
                            const maxAllowed = Math.max(0, Math.floor(window.innerHeight - r.top - bottomPadding));
                            if (standaloneSwitcherOpen) {
                                h = maxAllowed;
                            } else {
                                h = Math.min(h, maxAllowed);
                            }
                        } catch (_) {}
                        standaloneIframe.style.height = h + 'px';
                    }
                } else if (e.data?.type === 'search-engines-display-changed') {
                    // no-op (display mode is per-search-bar now)
                } else if (e.data?.type === 'switcher-request-viewport') {
                    const sourceWin = e.source;
                    const sourceIsAddressbar = iframe && sourceWin === iframe.contentWindow;
                    const sourceIsStandalone = standaloneIframe && sourceWin === standaloneIframe.contentWindow;
                    const targetIframe = sourceIsAddressbar ? iframe : (sourceIsStandalone ? standaloneIframe : null);
                    if (targetIframe) {
                        try {
                            const r = targetIframe.getBoundingClientRect();
                            targetIframe.contentWindow?.postMessage({
                                type: 'switcher-viewport',
                                viewportH: window.innerHeight,
                                frameTop: r.top
                            }, '*');
                        } catch (_) {}
                    }
                } else if (e.data?.type === 'switcher-open-state') {
                    const sourceWin = e.source;
                    const sourceIsAddressbar = iframe && sourceWin === iframe.contentWindow;
                    const sourceIsStandalone = standaloneIframe && sourceWin === standaloneIframe.contentWindow;
                    const targetIframe = sourceIsAddressbar ? iframe : (sourceIsStandalone ? standaloneIframe : null);
                    if (sourceIsAddressbar) addressbarSwitcherOpen = !!e.data?.open;
                    if (sourceIsStandalone) standaloneSwitcherOpen = !!e.data?.open;

                    if (targetIframe && e.data?.open === true) {
                        try {
                            const r = targetIframe.getBoundingClientRect();
                            const bottomPadding = 8;
                            const maxAllowed = Math.max(0, Math.floor(window.innerHeight - r.top - bottomPadding));
                            targetIframe.style.height = maxAllowed + 'px';
                            if (targetIframe === iframe) updateBandHeight(maxAllowed);
                        } catch (_) {}
                    }
                    if (targetIframe && e.data?.open === false) {
                        // Restore iframe height so it doesn't block the main page.
                        try {
                            const r = targetIframe.getBoundingClientRect();
                            const bottomPadding = 8;
                            const maxAllowed = Math.max(0, Math.floor(window.innerHeight - r.top - bottomPadding));
                            let restoreH = null;
                            if (targetIframe === iframe && typeof lastAddressbarReportedHeight === 'number') {
                                restoreH = lastAddressbarReportedHeight;
                            }
                            if (targetIframe === standaloneIframe && typeof lastStandaloneReportedHeight === 'number') {
                                restoreH = lastStandaloneReportedHeight;
                            }
                            if (typeof restoreH === 'number') {
                                restoreH = Math.min(restoreH, maxAllowed);
                                targetIframe.style.height = restoreH + 'px';
                                if (targetIframe === iframe) updateBandHeight(restoreH);
                            }
                        } catch (_) {}
                    }
                }
            };
            updateIframeSize();
            document.documentElement.style.setProperty('--addressbar-band-bar-height', '58px');
            window.addEventListener('resize', updateIframeSize);
            window.addEventListener('message', setHeight);
            iframe.addEventListener('load', () => {
                updateIframeSize();
                sendPrototypeOptionsToIframes();
                try {
                    const doc = iframe.contentDocument;
                    const container = doc?.querySelector('.search-container');
                    if (container) {
                        const h = container.getBoundingClientRect().height + 4;
                        iframe.style.height = h + 'px';
                        updateBandHeight(h);
                    }
                } catch (_) { /* cross-origin */ }
            });
        }
        if (standaloneIframe) {
            standaloneIframe.addEventListener('load', sendPrototypeOptionsToIframes);
        }
        if (iframes.some(f => f.contentDocument?.readyState === 'complete')) {
            sendPrototypeOptionsToIframes();
        }
        window.addEventListener('resize', sendPrototypeOptionsToIframes);
        document.addEventListener('click', (e) => {
            if (e.target.closest?.('.bottom-left-panel-content')) {
                return;
            }
            iframes.forEach(f => {
                try {
                    f.contentWindow?.postMessage({ type: 'close-switcher' }, '*');
                } catch (_) {}
            });
        });
        const bumpPrototypeOptionsInteractionSuppress = () => {
            window.__prototypeOptionsBlurSuppressUntil = Date.now() + 800;
        };
        document.querySelector('.bottom-left-panel')?.addEventListener(
            'mousedown',
            () => {
                bumpPrototypeOptionsInteractionSuppress();
                iframes.forEach(f => {
                    try {
                        f.contentWindow?.postMessage({ type: 'prototype-panel-interaction' }, '*');
                    } catch (_) {}
                });
            },
            true
        );
    }

    // Mouse-positioned tooltips
    const tooltipEl = document.createElement('div');
    tooltipEl.id = 'global-tooltip';
    document.body.appendChild(tooltipEl);
    let tooltipHideTimer = null;
    let activeTrigger = null;
    let tooltipPinned = false;

    const positionTooltip = (trigger, position) => {
        const rect = trigger.getBoundingClientRect();
        const gap = 6;
        tooltipEl.style.left = '';
        tooltipEl.style.right = '';
        tooltipEl.style.top = '';
        tooltipEl.style.bottom = '';
        tooltipEl.classList.add('tooltip-visible');
        tooltipEl.offsetHeight; // force reflow
        const w = tooltipEl.offsetWidth;
        const h = tooltipEl.offsetHeight;
        const pos = position || 'bottom-right';
        if (pos === 'bottom-right') {
            tooltipEl.style.left = rect.right + gap + 'px';
            tooltipEl.style.top = rect.bottom + gap + 'px';
        } else if (pos === 'bottom-left') {
            tooltipEl.style.left = (rect.left - w - gap) + 'px';
            tooltipEl.style.top = rect.bottom + gap + 'px';
        } else if (pos === 'top-right') {
            tooltipEl.style.left = rect.right + gap + 'px';
            tooltipEl.style.top = (rect.top - h - gap) + 'px';
        } else if (pos === 'top-left') {
            tooltipEl.style.left = (rect.left - w - gap) + 'px';
            tooltipEl.style.top = (rect.top - h - gap) + 'px';
        }
    };

    const showTooltip = (trigger) => {
        const popup = trigger.querySelector('.tooltip-popup');
        const text = trigger.getAttribute('data-tooltip');
        const position = trigger.getAttribute('data-tooltip-position') || 'bottom-right';
        const content = popup ? popup.innerHTML : (text || '');
        if (!content) return;
        tooltipEl.innerHTML = '<button type="button" class="tooltip-close" aria-label="Close">×</button><span class="tooltip-body"></span>';
        tooltipEl.querySelector('.tooltip-body').innerHTML = content;
        tooltipEl.querySelector('.tooltip-close').addEventListener('click', hideTooltip);
        activeTrigger = trigger;
        positionTooltip(trigger, position);
    };

    const hideTooltip = () => {
        tooltipEl.classList.remove('tooltip-visible', 'tooltip-pinned');
        tooltipEl.innerHTML = '';
        activeTrigger = null;
        tooltipPinned = false;
    };

    const scheduleHide = () => {
        if (tooltipPinned) return;
        tooltipHideTimer = setTimeout(hideTooltip, 150);
    };

    document.addEventListener('mouseover', (e) => {
        const trigger = e.target.closest('.tooltip-trigger');
        if (trigger) {
            const inSwitcherDropdown = trigger.closest('.search-switcher-dropdown');
            const switcherSuppressing = document.querySelector('.search-switcher-button.switcher-suppress-hover');
            if (inSwitcherDropdown && switcherSuppressing) return;
            if (tooltipHideTimer) {
                clearTimeout(tooltipHideTimer);
                tooltipHideTimer = null;
            }
            showTooltip(trigger);
        }
    });

    document.addEventListener('mouseout', (e) => {
        const trigger = e.target.closest('.tooltip-trigger');
        const toTooltip = e.relatedTarget?.closest('#global-tooltip');
        if (trigger && !toTooltip && e.relatedTarget && !trigger.contains(e.relatedTarget)) {
            scheduleHide();
        }
    });

    document.addEventListener('mousedown', (e) => {
        const trigger = e.target.closest('.tooltip-trigger');
        const inTooltip = e.target.closest('#global-tooltip');
        if (trigger || inTooltip) {
            tooltipPinned = true;
            tooltipEl.classList.add('tooltip-pinned');
        }
    });

    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.tooltip-trigger');
        const inTooltip = e.target.closest('#global-tooltip');
        if (inTooltip) {
            tooltipPinned = true;
            tooltipEl.classList.add('tooltip-pinned');
        } else if (trigger) {
            if (tooltipPinned && activeTrigger === trigger) {
                hideTooltip();
            } else {
                tooltipPinned = true;
                tooltipEl.classList.add('tooltip-pinned');
            }
        } else if (activeTrigger || tooltipEl.classList.contains('tooltip-visible')) {
            hideTooltip();
        }
    });

    tooltipEl.addEventListener('mouseenter', () => {
        if (tooltipHideTimer) {
            clearTimeout(tooltipHideTimer);
            tooltipHideTimer = null;
        }
    });

    tooltipEl.addEventListener('mouseleave', () => {
        if (!tooltipPinned) hideTooltip();
    });

    const searchInput = document.querySelector('.search-input');
    const inspectSuggestions = new URLSearchParams(location.search).get('inspect') === '1' || localStorage.getItem('inspectSuggestions') === 'true';

    // Clear search input on page load
    if (searchInput) {
        searchInput.value = '';
    }
    const searchContainer = document.querySelector('.search-container');
    const firefoxLogo = document.querySelector('.firefox-logo');

    // Repositionable search bar (testing)
    const searchDragHandle = document.querySelector('.search-container-drag-handle');
    const LOGO_NEAR_TOP_THRESHOLD = 250;
    function updateLogoPositionForSearchBar(opts = {}) {
        if (!searchContainer || !firefoxLogo) return;
        if (opts.skipWhenLogoOnLeft && document.body.classList.contains('search-bar-near-top')) return;
        const rect = searchContainer.getBoundingClientRect();
        const searchCenterY = rect.top + rect.height / 2;
        const logoHeight = firefoxLogo.getBoundingClientRect().height;
        if (rect.top < LOGO_NEAR_TOP_THRESHOLD) {
            document.body.classList.add('search-bar-near-top');
            document.documentElement.style.setProperty('--logo-near-top-y', (searchCenterY - logoHeight / 2 + 45) + 'px');
        } else {
            document.body.classList.remove('search-bar-near-top');
        }
    }
    if (searchDragHandle && searchContainer) {
        let searchDragOffsetY = 0;
        const updateDraggedClasses = () => {
            document.body.classList.toggle('search-bar-dragged-down', searchDragOffsetY > 0);
            document.body.classList.toggle('search-bar-dragged-up', searchDragOffsetY < 0);
        };
        const onPointerMove = (e) => {
            searchDragOffsetY += e.movementY;
            document.documentElement.style.setProperty('--search-drag-offset-y', searchDragOffsetY + 'px');
            updateDraggedClasses();
        };
        const onPointerUp = () => {
            try { searchDragHandle.releasePointerCapture(pointerId); } catch (_) {}
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('pointercancel', onPointerUp);
            searchContainer.style.transition = '';
            const wasNearTop = document.body.classList.contains('search-bar-near-top');
            if (wasNearTop && firefoxLogo) {
                firefoxLogo.style.transition = 'none';
            }
            updateLogoPositionForSearchBar();
            if (wasNearTop && firefoxLogo) {
                firefoxLogo.offsetHeight;
                requestAnimationFrame(() => {
                    firefoxLogo.style.transition = '';
                });
            }
        };
        let pointerId;
        searchDragHandle.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            pointerId = e.pointerId;
            searchDragHandle.setPointerCapture(pointerId);
            searchContainer.style.transition = 'none';
            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
            document.addEventListener('pointercancel', onPointerUp);
        });
    }
    updateLogoPositionForSearchBar();
    window.addEventListener('resize', updateLogoPositionForSearchBar);
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
    const searchUrlButton = document.querySelector('.search-url-button');
    const searchButton = document.querySelector('.search-button');
    const clearCacheButton = document.getElementById('clear-cache-button');
    let clearCacheSuccessTimer = null;
    let switcherHighlightedIndex = -1;
    let switcherHoveredIndex = -1;
    let restoringFocusFromSwitcher = false;
    let closingSwitcherWithoutSuggestions = false;

    function restoreFocusAndOpaqueSuggestions() {
        restoringFocusFromSwitcher = true;
        searchInput?.focus();
        if (suggestionsList) {
            suggestionsList.classList.remove('first-hover-fade', 'transitioning');
        }
        firstHoverDone = true;
    }

    function closeSuggestionsPanel() {
        if (!searchContainer) return;
        searchContainer.classList.remove('focused');
        let logoUpdateDone = false;
        const runLogoUpdate = () => {
            if (!logoUpdateDone) {
                logoUpdateDone = true;
                searchContainer.removeEventListener('transitionend', onTransitionEnd);
                updateLogoPositionForSearchBar({ skipWhenLogoOnLeft: true });
            }
        };
        const onTransitionEnd = (e) => {
            if (e.target === searchContainer && (e.propertyName === 'top' || e.propertyName === 'transform')) {
                runLogoUpdate();
            }
        };
        searchContainer.addEventListener('transitionend', onTransitionEnd);
        const blurTransitionMs = document.body.classList.contains('reduced-motion') ? 350 : 250;
        setTimeout(runLogoUpdate, blurTransitionMs + 50);
        suggestionsList?.classList.remove('suggestions-revealed');
        firstHoverDone = false;
        if (suggestionsList) {
            suggestionsList.classList.add('transitioning');
            suggestionsList.classList.remove('first-hover-fade');
            const closeDuration = document.body.classList.contains('addressbar') ? 320 : 250;
            setTimeout(() => {
                suggestionsList.classList.remove('transitioning');
            }, closeDuration);
        }
    }

    function applySelectedSearchSource(item) {
        if (!item) return;
        if (item.id === 'quick-buttons-toggle') return;
        const iconEl = item.querySelector('.dropdown-engine-icon, .dropdown-icon');
        const labelEl = item.querySelector('.dropdown-engine-label');
        const label = labelEl ? labelEl.textContent.trim() : item.textContent.replace(/\s+/g, ' ').trim();
        if (iconEl && label) {
            const switcherIcon = searchSwitcherButton?.querySelector('.google-icon');
            const switcherLabel = searchSwitcherButton?.querySelector('.switcher-button-label');
            if (switcherIcon) {
                switcherIcon.src = iconEl.src || iconEl.getAttribute('src');
                switcherIcon.alt = label;
            }
            const localSources = ['Bookmarks', 'History', 'Tabs', 'Actions'];
            if (switcherLabel) {
                if (localSources.includes(label)) {
                    switcherLabel.textContent = label;
                    switcherLabel.hidden = false;
                } else {
                    switcherLabel.textContent = '';
                    switcherLabel.hidden = true;
                    suggestionsList?.classList.remove('suggestions-suppress-until-typed');
                    if (searchInput && !searchInput.value?.trim() && searchContainer?.classList.contains('focused')) {
                        const defaultSuggestions = ['hoka', '13 in macbook air', 'coffee machines for sale', 'taylor swift', 'coffee grinder'];
                        updateSuggestions(defaultSuggestions);
                        suggestionsList?.classList.add('suggestions-revealed');
                    }
                }
            }
            const preposition = localSources.includes(label) ? 'in' : 'with';
            if (searchInput) {
                const isAddressbar = document.body.classList.contains('addressbar');
                const isStandalone = document.body.classList.contains('standalone-search-box');
                searchInput.placeholder = isAddressbar && !isStandalone
                    ? 'Search ' + preposition + ' ' + label + ' or enter address'
                    : 'Search ' + preposition + ' ' + label;
            }
            // Update "Search with X" hints on existing suggestion items
            const hint = 'Search with ' + label;
            document.querySelectorAll('.suggestion-item:not(.gmail-item):not(.firefox-suggest-item):not(.visit-site-suggestion) .suggestion-hint-text').forEach(el => {
                el.dataset.searchHint = hint;
            });
        }
    }

    function getEngineLabel(item) {
        if (!item) return '';
        const labelEl = item.querySelector('.dropdown-engine-label');
        return labelEl ? labelEl.textContent.trim() : '';
    }

    function iconSrcRoughMatch(a, b) {
        if (!a || !b) return false;
        if (a === b) return true;
        const norm = (s) => s.replace(/^.*\/icons\//, 'icons/').replace(/^\.\//, '');
        return norm(a) === norm(b);
    }

    /** Ctrl/Cmd + Arrow from the search field: cycle visible engines without opening the switcher. delta: +1 = next, -1 = previous */
    function cycleSwitcherEngineFromSearchField(delta) {
        if (!searchSwitcherButton || (delta !== 1 && delta !== -1)) return;
        const enginesContainer = searchSwitcherButton.querySelector('.dropdown-search-engines');
        if (!enginesContainer) return;
        const engineItems = Array.from(enginesContainer.children).filter(
            (c) =>
                c.classList.contains('dropdown-item') &&
                c.querySelector('.dropdown-engine-label') &&
                c.style.display !== 'none'
        );
        if (engineItems.length === 0) return;

        const switcherLabel = searchSwitcherButton.querySelector('.switcher-button-label');
        const switcherIcon = searchSwitcherButton.querySelector('.google-icon');
        let idx = -1;
        if (switcherLabel && !switcherLabel.hidden && switcherLabel.textContent.trim()) {
            idx = -1;
        } else {
            const iconSrc = switcherIcon?.getAttribute('src') || '';
            idx = engineItems.findIndex((item) => {
                const iconEl = item.querySelector('.dropdown-engine-icon, .dropdown-icon');
                return iconEl && iconSrcRoughMatch(iconEl.getAttribute('src') || '', iconSrc);
            });
            if (idx < 0) {
                const pinned = enginesContainer.querySelector('.dropdown-item-pinned');
                if (pinned) idx = engineItems.indexOf(pinned);
            }
        }

        let nextIdx;
        if (idx < 0) {
            nextIdx = delta > 0 ? 0 : engineItems.length - 1;
        } else {
            nextIdx = (idx + delta + engineItems.length) % engineItems.length;
        }
        applySelectedSearchSource(engineItems[nextIdx]);
    }

    /** Scroll parent for the engine list (combined wrapper scrolls when present; else .dropdown-search-engines). */
    function getEngineListScrollEl(enginesContainer) {
        if (!enginesContainer) return null;
        const wrap = enginesContainer.closest('.dropdown-engines-firefox-scroll');
        return wrap || enginesContainer;
    }

    function getSearchEngineSuggestionObjectsFromDropdown() {
        const switcherDropdown = searchSwitcherButton?.querySelector('.search-switcher-dropdown');
        if (!switcherDropdown) return [];
        const engineItems = Array.from(switcherDropdown.querySelectorAll('.dropdown-search-engines .dropdown-item')).filter(
            (el) => el.querySelector('.dropdown-engine-label')
        );
        return engineItems.map((item) => {
            const label = getEngineLabel(item);
            const iconEl = item.querySelector('.dropdown-engine-icon, .dropdown-icon');
            const icon = iconEl?.getAttribute('src') || '';
            return { _localSource: true, _searchEngine: true, label, icon };
        });
    }

    function isEngineListAlphabeticalInContainer(enginesContainer) {
        if (!enginesContainer) return true;
        const items = Array.from(enginesContainer.children).filter(
            (c) => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
        );
        const labels = items.map((i) => getEngineLabel(i));
        const sorted = [...labels].sort((a, b) => a.localeCompare(b));
        return labels.length === sorted.length && labels.every((l, i) => l === sorted[i]);
    }

    function updateReorderResetButtonState() {
        const btn = document.getElementById('search-engines-reset-order-button');
        if (!btn) return;
        const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        const alphabetical = isEngineListAlphabeticalInContainer(enginesContainer);
        if (alphabetical) {
            btn.setAttribute('hidden', '');
            btn.disabled = true;
        } else {
            btn.removeAttribute('hidden');
            btn.disabled = false;
        }
    }

    function syncDefaultBadgeDraggableState() {
        const badge = searchSwitcherButton?.querySelector('.dropdown-default-badge');
        if (!badge) return;
        const open = !!searchSwitcherButton?.classList.contains('search-engines-controls-open');
        badge.classList.toggle('dropdown-default-badge--draggable', open);
        if (open) {
            badge.setAttribute('title', 'Drag to move default search engine');
            badge.setAttribute('aria-label', 'Default search engine — drag to move');
        } else {
            badge.setAttribute('title', 'Default search engine');
            badge.setAttribute('aria-label', 'Default search engine');
        }
    }

    function syncEngineDragHandlesForControlsPanel() {
        const panel = document.getElementById('search-engines-controls-panel');
        const open = panel && !panel.hasAttribute('hidden');
        if (searchSwitcherButton) {
            searchSwitcherButton.classList.toggle('search-engines-controls-open', !!open);
        }
        const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        if (!enginesContainer) return;
        const items = Array.from(enginesContainer.querySelectorAll('.dropdown-item')).filter((el) =>
            el.querySelector('.dropdown-engine-label')
        );
        items.forEach((item) => {
            if (open) {
                if (!item.querySelector('.dropdown-item-drag-handle')) {
                    const span = document.createElement('span');
                    span.className = 'dropdown-item-drag-handle';
                    span.setAttribute('aria-hidden', 'true');
                    span.innerHTML = '<img src="icons/drag-handle.svg" alt="">';
                    const pin = item.querySelector('.dropdown-item-pin-empty, .dropdown-item-pin');
                    if (pin) pin.before(span);
                    else item.appendChild(span);
                }
            } else {
                item.querySelectorAll('.dropdown-item-drag-handle').forEach((h) => h.remove());
            }
        });
        syncDefaultBadgeDraggableState();
    }

    function clearFromFirefoxFooterFlipStyles() {
        const footer = searchSwitcherButton?.querySelector('.dropdown-from-firefox-footer');
        if (!footer) return;
        footer.style.transition = '';
        footer.style.transform = '';
        searchSwitcherButton?.classList.remove('search-switcher-info-panel-footer-flip');
    }

    /**
     * Width must not follow the Shortcuts (i) panel text: CSS `width: max-content` on the dropdown
     * still used intrinsic max-content from that subtree in some engines. Measure with the info shell
     * out of flow, then set a fixed px width so wrapping stays inside the menu width.
     */
    function syncSearchSwitcherDropdownWidth() {
        const btn = document.querySelector('.search-switcher-button');
        const dropdown = btn?.querySelector('.search-switcher-dropdown');
        const infoShell = dropdown?.querySelector('.dropdown-search-info-shell');
        const infoPanel = document.getElementById('search-switcher-info-panel');
        if (!dropdown) return;
        if (!btn?.classList.contains('open')) {
            // Keep fixed px width until max-height collapse finishes; clearing here makes width:auto
            // reflow to a narrower intrinsic width while height still animates (iframes especially).
            if (document.body.classList.contains('reduced-motion')) {
                dropdown.style.width = '';
            }
            return;
        }
        if (!infoShell) {
            void dropdown.offsetWidth;
            const w = Math.min(Math.max(dropdown.scrollWidth, 200), window.innerWidth - 24);
            dropdown.style.width = `${w}px`;
            return;
        }
        // While Shortcuts is open or closing, never `display:none` the info shell — that kills the slide transition.
        // Keep width at least the previous px width so the menu does not shrink to the shortcuts column.
        if (infoPanel && !infoPanel.hasAttribute('hidden')) {
            void dropdown.offsetWidth;
            const measured = dropdown.scrollWidth;
            const capped = Math.min(Math.max(measured, 200), window.innerWidth - 24);
            const currentPx = parseFloat(String(dropdown.style.width).replace(/px$/i, '')) || 0;
            dropdown.style.width = `${Math.max(capped, currentPx)}px`;
            return;
        }
        const prevDisplay = infoShell.style.display;
        infoShell.style.display = 'none';
        void dropdown.offsetWidth;
        const measured = dropdown.scrollWidth;
        infoShell.style.display = prevDisplay;
        void dropdown.offsetWidth;
        const capped = Math.min(Math.max(measured, 200), window.innerWidth - 24);
        dropdown.style.width = `${capped}px`;
    }

    /** Clear inline width only after vertical collapse; see syncSearchSwitcherDropdownWidth when !open. */
    function registerSwitcherDropdownWidthCollapseCleanup() {
        const dropdown = searchSwitcherButton?.querySelector('.search-switcher-dropdown');
        if (!dropdown || dropdown.dataset.switcherWidthCollapseCleanup) return;
        dropdown.dataset.switcherWidthCollapseCleanup = '1';
        dropdown.addEventListener('transitionend', (e) => {
            if (e.target !== dropdown || e.propertyName !== 'max-height') return;
            if (!searchSwitcherButton?.classList.contains('open')) {
                dropdown.style.width = '';
            }
        });
    }
    registerSwitcherDropdownWidthCollapseCleanup();

    /** When the search switcher dropdown closes, fully settle info + controls sub-panels (not mid-animation). */
    function forceCloseSearchSwitcherSubPanels() {
        const panel = document.getElementById('search-engines-controls-panel');
        const infoPanel = document.getElementById('search-switcher-info-panel');
        const subpanelsClipEl =
            panel?.closest('.dropdown-switcher-subpanels-clip') ??
            infoPanel?.closest('.dropdown-switcher-subpanels-clip');
        subpanelsClipEl?.classList.remove('dropdown-switcher-subpanels-clip--open');
        searchSwitcherButton?.classList.remove('search-engines-controls-panel-revealed');
        searchSwitcherButton?.classList.remove('search-switcher-info-panel-footer-flip');
        panel?.setAttribute('hidden', '');
        infoPanel?.setAttribute('hidden', '');
        document.getElementById('search-engines-controls-toggle')?.setAttribute('aria-expanded', 'false');
        document.getElementById('search-switcher-info-toggle')?.setAttribute('aria-expanded', 'false');
        clearFromFirefoxFooterFlipStyles();
        syncEngineDragHandlesForControlsPanel();
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, (c) => {
            if (c === '&') return '&amp;';
            if (c === '<') return '&lt;';
            if (c === '>') return '&gt;';
            if (c === '"') return '&quot;';
            return '&#39;';
        });
    }

    function applyEngineInitialUnderlines() {
        const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        if (!enginesContainer) return;
        const items = Array.from(enginesContainer.children).filter(
            c => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
        );

        const firstSeen = new Set();
        items.forEach((item) => {
            const labelEl = item.querySelector('.dropdown-engine-label');
            if (!labelEl) return;

            if (!labelEl.dataset.originalLabel) {
                labelEl.dataset.originalLabel = labelEl.textContent || '';
            }

            const original = labelEl.dataset.originalLabel;
            const trimmed = (original || '').trim();
            if (!trimmed) {
                labelEl.textContent = '';
                return;
            }

            const firstChar = trimmed[0];
            const key = /^[a-z]/i.test(firstChar) ? firstChar.toUpperCase() : '';
            const shouldUnderline = key && !firstSeen.has(key);
            if (key) firstSeen.add(key);

            if (!shouldUnderline) {
                labelEl.textContent = trimmed;
                return;
            }

            labelEl.innerHTML = `<span class="engine-initial-underline">${escapeHtml(firstChar)}</span>${escapeHtml(trimmed.slice(1))}`;
        });
    }

    function clearEngineInitialUnderlines() {
        const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        if (!enginesContainer) return;
        const items = Array.from(enginesContainer.children).filter(
            c => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
        );
        items.forEach((item) => {
            const labelEl = item.querySelector('.dropdown-engine-label');
            if (!labelEl) return;
            if (labelEl.dataset.originalLabel) {
                labelEl.textContent = labelEl.dataset.originalLabel;
            } else {
                labelEl.textContent = labelEl.textContent || '';
            }
        });
    }

    function getCurrentSearchEngineLabel() {
        const icon = searchSwitcherButton?.querySelector('.google-icon');
        if (icon?.alt) return icon.alt;
        return getDefaultSearchEngineLabelFromStorage();
    }

    const ENGINE_SEARCH_URLS = {
        'Google': 'https://www.google.com/search?q=',
        'Bing': 'https://www.bing.com/search?q=',
        'DuckDuckGo': 'https://duckduckgo.com/?q=',
        'Ecosia': 'https://www.ecosia.org/search?q=',
        'eBay': 'https://www.ebay.com/sch/i.html?_nkw=',
        'Perplexity': 'https://www.perplexity.ai/search?q=',
        'Yahoo': 'https://search.yahoo.com/search?p=',
        'Wikipedia (en)': 'https://en.wikipedia.org/w/index.php?search=',
        'Amazon': 'https://www.amazon.com/s?k=',
        'IMDb': 'https://www.imdb.com/find?q=',
        'Reddit': 'https://www.reddit.com/search?q=',
        'Startpage': 'https://www.startpage.com/sp/search?query=',
        'YouTube': 'https://www.youtube.com/results?search_query='
    };

    function runSearchWithSelectedEngine(query, sameTab = true) {
        runSearchWithEngine(query, getCurrentSearchEngineLabel(), sameTab);
    }

    function runSearchWithEngine(query, engineLabel, sameTab = true) {
        const q = (query || '').trim();
        if (!q) return;
        const baseUrl = ENGINE_SEARCH_URLS[engineLabel] || ENGINE_SEARCH_URLS['Google'];
        const url = baseUrl + encodeURIComponent(q);
        const target = window.top;
        if (sameTab) {
            target.location.href = url;
        } else {
            // Best-effort "background tab": open then re-focus this window.
            const w = target.open(url, '_blank', 'noopener,noreferrer');
            try {
                w?.blur?.();
            } catch (_) {}
            try {
                window.focus();
            } catch (_) {}
        }
    }

    function getFirefoxSuggestionsState() {
        try {
            const raw = localStorage.getItem(FIREFOX_SUGGESTIONS_ENABLED_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return {
                    bookmarks: parsed.bookmarks !== false,
                    tabs: parsed.tabs !== false,
                    history: parsed.history !== false,
                    actions: parsed.actions !== false,
                    recommendations: parsed.recommendations !== false,
                    partners: parsed.partners !== false
                };
            }
        } catch (_) {}
        return { bookmarks: true, tabs: true, history: true, actions: true, recommendations: true, partners: true };
    }

    function setFirefoxSuggestionState(type, enabled) {
        const state = getFirefoxSuggestionsState();
        state[type] = enabled;
        localStorage.setItem(FIREFOX_SUGGESTIONS_ENABLED_KEY, JSON.stringify(state));
    }

    function toggleFirefoxSuggestionCheckbox(el) {
        if (!el) return;
        el.classList.toggle('checked');
        const isChecked = el.classList.contains('checked');
        el.setAttribute('aria-pressed', isChecked);
        el.title = isChecked ? 'Include in suggestions' : 'Exclude from suggestions';
        const item = el.closest('.dropdown-item-firefox-suggestion');
        const type = item?.getAttribute('data-suggestion-type');
        if (type) setFirefoxSuggestionState(type, isChecked);
    }

    function restoreFirefoxSuggestionsState() {
        const state = getFirefoxSuggestionsState();
        document.querySelectorAll('.dropdown-item-firefox-suggestion').forEach(item => {
            const type = item?.getAttribute('data-suggestion-type');
            if (!type) return;
            const toggle = item.querySelector('.dropdown-firefox-toggle');
            if (!toggle) return;
            const enabled = state[type] !== false;
            toggle.classList.toggle('checked', enabled);
            toggle.setAttribute('aria-pressed', enabled);
            toggle.title = enabled ? 'Include in suggestions' : 'Exclude from suggestions';
        });
    }

    function ensureRowActions() {
        const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        if (!enginesContainer) return;
        const engineItems = Array.from(enginesContainer.querySelectorAll('.dropdown-item')).filter(
            el => el.querySelector('.dropdown-engine-label')
        );
        const openNewWindowHtml = '<span class="dropdown-item-row-action" aria-hidden="true"><span class="dropdown-item-keyboard-num" aria-hidden="true"></span><button type="button" class="dropdown-item-open-new-window" title="Open in a new tab" aria-label="Open in a new tab"><img src="icons/open-in-new-window.svg" alt=""></button></span>';
        engineItems.forEach(item => {
            if (!item.querySelector('.dropdown-item-row-action')) {
                const pin = item.querySelector('.dropdown-item-pin-empty, .dropdown-item-pin');
                if (pin) pin.insertAdjacentHTML('beforebegin', openNewWindowHtml);
            } else if (!item.querySelector('.dropdown-item-keyboard-num')) {
                const action = item.querySelector('.dropdown-item-row-action');
                if (action && !action.querySelector('.dropdown-item-keyboard-num')) {
                    action.insertAdjacentHTML('afterbegin', '<span class="dropdown-item-keyboard-num" aria-hidden="true"></span>');
                }
            }
        });
    }

    function updateKeyboardNumbers() {
        const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        if (!enginesContainer) return;
        const engineItems = Array.from(enginesContainer.children).filter(
            c => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
        );
        engineItems.forEach((item, i) => {
            const numEl = item.querySelector('.dropdown-item-keyboard-num');
            if (numEl) numEl.textContent = i < 9 ? String(i + 1) : '';
        });
    }

    function setPinnedEngine(pinnedItem) {
        const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        if (!enginesContainer) return;
        ensureRowActions();
        const engineItems = Array.from(enginesContainer.querySelectorAll('.dropdown-item')).filter(
            el => el.querySelector('.dropdown-engine-label')
        );
        const pinEmptyHtml = '<span class="dropdown-item-pin-empty" title="Make default"><img src="icons/pin.svg" alt="" class="pin-outline" aria-hidden="true"><img src="icons/pin-filled.svg" alt="" class="pin-filled" aria-hidden="true"></span>';
        const pinHtml = '<img src="icons/pin-filled.svg" alt="" class="dropdown-item-pin" title="Default search engine">';
        engineItems.forEach(item => {
            const isPinned = item === pinnedItem;
            if (isPinned) {
                item.classList.remove('dropdown-item-search-engine');
                item.classList.add('dropdown-item-pinned');
                const pin = item.querySelector('.dropdown-item-pin-empty, .dropdown-item-pin');
                if (pin) {
                    pin.replaceWith(document.createRange().createContextualFragment(pinHtml));
                }
            } else {
                item.classList.remove('dropdown-item-pinned');
                item.classList.add('dropdown-item-search-engine');
                const pin = item.querySelector('.dropdown-item-pin-empty, .dropdown-item-pin');
                if (pin) {
                    pin.replaceWith(document.createRange().createContextualFragment(pinEmptyHtml));
                }
            }
        });
        updateDefaultBadge();
    }

    /**
     * Re-apply pinned row + switcher chrome from `getDefaultSearchEngineLabelFromStorage()` (e.g. after badge drag / mirror).
     */
    function applySearchSwitcherUIFromStoredDefault() {
        if (!searchSwitcherButton) return;
        const enginesContainer = searchSwitcherButton.querySelector('.dropdown-search-engines');
        if (!enginesContainer) return;
        const want = getDefaultSearchEngineLabelFromStorage();
        const visibleItems = Array.from(enginesContainer.querySelectorAll('.dropdown-item')).filter(
            (el) =>
                el.querySelector('.dropdown-engine-label') &&
                el.style.display !== 'none'
        );
        let match = visibleItems.find((item) => getEngineLabel(item) === want);
        if (!match) {
            match = visibleItems.find((item) => getEngineLabel(item) === 'Google') || visibleItems[0];
        }
        if (!match) return;
        applySelectedSearchSource(match);
        setPinnedEngine(match);
    }

    /** Move pin/default badge only; does not change the switcher button icon (current selection may differ from default). */
    function applySearchSwitcherPinnedDefaultOnly() {
        if (!searchSwitcherButton) return;
        const enginesContainer = searchSwitcherButton.querySelector('.dropdown-search-engines');
        if (!enginesContainer) return;
        const want = getDefaultSearchEngineLabelFromStorage();
        const visibleItems = Array.from(enginesContainer.querySelectorAll('.dropdown-item')).filter(
            (el) =>
                el.querySelector('.dropdown-engine-label') &&
                el.style.display !== 'none'
        );
        let match = visibleItems.find((item) => getEngineLabel(item) === want);
        if (!match) {
            match = visibleItems.find((item) => getEngineLabel(item) === 'Google') || visibleItems[0];
        }
        if (!match) return;
        setPinnedEngine(match);
    }

    /**
     * After Search settings changed a stored default: update full switcher chrome only if the user was still
     * showing the old default as the selected engine; otherwise only move the pinned default row.
     * @param {string} oldEffectiveDefault — effective default for this surface before the settings write
     */
    function applySearchSwitcherAfterSearchSettingsChange(oldEffectiveDefault) {
        const oldDef = String(oldEffectiveDefault || '').trim();
        const icon = searchSwitcherButton?.querySelector('.google-icon');
        const currentSel = (icon?.alt && String(icon.alt).trim()) ? String(icon.alt).trim() : oldDef;
        if (currentSel === oldDef) {
            applySearchSwitcherUIFromStoredDefault();
        } else {
            applySearchSwitcherPinnedDefaultOnly();
        }
    }

    function updateDefaultBadge() {
        const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        if (!enginesContainer) {
            defaultBadgeLog('updateDefaultBadge: abort — no .dropdown-search-engines');
            return;
        }
        enginesContainer.querySelectorAll('.dropdown-default-badge-wrap').forEach((b) => b.remove());
        if (document.body.classList.contains('pin-default-enabled')) {
            defaultBadgeLog('updateDefaultBadge: abort — body.pin-default-enabled (pin-default mode hides badge)');
            return;
        }
        const pinned = enginesContainer.querySelector('.dropdown-item-pinned');
        if (!pinned) {
            defaultBadgeLog('updateDefaultBadge: abort — no .dropdown-item-pinned');
            return;
        }
        const labelEl = pinned.querySelector('.dropdown-engine-label');
        if (!labelEl) {
            defaultBadgeLog('updateDefaultBadge: abort — pinned row has no .dropdown-engine-label');
            return;
        }
        const wrap = document.createElement('span');
        wrap.className = 'dropdown-default-badge-wrap';
        const badge = document.createElement('span');
        badge.className = 'dropdown-default-badge';
        badge.setAttribute('draggable', 'false');
        badge.setAttribute('role', 'button');
        badge.setAttribute('tabindex', '-1');
        const textSpan = document.createElement('span');
        textSpan.className = 'dropdown-default-badge-text';
        textSpan.setAttribute('aria-hidden', 'true');
        textSpan.textContent = 'DEFAULT';
        const drag = document.createElement('span');
        drag.className = 'dropdown-default-badge-drag';
        drag.setAttribute('aria-hidden', 'true');
        drag.innerHTML = '<img src="icons/drag-handle.svg" alt="">';
        badge.appendChild(textSpan);
        badge.appendChild(drag);
        wrap.appendChild(badge);
        labelEl.insertAdjacentElement('afterend', wrap);
        syncDefaultBadgeDraggableState();
        defaultBadgeLog('updateDefaultBadge: inserted badge after label', {
            wrap,
            badgeClasses: badge.className,
            gridMode: document.body.classList.contains('search-engines-display-grid'),
        });
    }

    function applySearchEnginesCountMode(showTwelve) {
        const allowed = new Set(
            (showTwelve
                ? ['Amazon', 'Bing', 'DuckDuckGo', 'Ecosia', 'eBay', 'Google', 'IMDb', 'Perplexity', 'Reddit', 'Startpage', 'Wikipedia (en)', 'YouTube']
                : ['Google', 'Bing', 'DuckDuckGo', 'eBay', 'Perplexity', 'Wikipedia (en)']
            )
        );

        const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        if (enginesContainer) {
            enginesContainer.querySelectorAll('.dropdown-item').forEach(item => {
                if (!item.querySelector('.dropdown-engine-label')) return;
                const label = getEngineLabel(item);
                item.style.display = allowed.has(label) ? '' : 'none';
            });

            const pinned = enginesContainer.querySelector('.dropdown-item-pinned');
            const pinnedLabel = pinned ? getEngineLabel(pinned) : '';
            if (pinned && pinnedLabel && !allowed.has(pinnedLabel)) {
                const items = Array.from(enginesContainer.querySelectorAll('.dropdown-item')).filter(
                    el => el.querySelector('.dropdown-engine-label') && el.style.display !== 'none'
                );
                const google = items.find(i => getEngineLabel(i) === 'Google') || items[0];
                if (google) {
                    applySelectedSearchSource(google);
                    setDefaultSearchEngineStorageItem(getDefaultSearchEngineStorageKeyForPage(), getEngineLabel(google));
                    setPinnedEngine(google);
                    syncSearchSettingsDefaultEngineSelects();
                    notifyParentDefaultSearchEngineChanged();
                }
            }
        }

        const oneOffContainer = document.querySelector('.one-off-engine-icons');
        if (oneOffContainer) {
            oneOffContainer.querySelectorAll('.one-off-engine-icon').forEach(btn => {
                const img = btn.querySelector('img');
                const label = img?.getAttribute('alt')?.trim() || '';
                btn.style.display = allowed.has(label) ? '' : 'none';
            });
        }
    }
    
    // Click on search-box-wrapper focuses the input
    if (searchBoxWrapper && searchInput) {
        let lastPrimaryUiClickAt = 0;

        // If a primary click (search bar / switcher) shifts the suggestions under the cursor,
        // suppress a rapid follow-up click that lands on the suggestions panel.
        document.addEventListener('click', (e) => {
            const now = Date.now();
            const isRapidSecondClick = now - lastPrimaryUiClickAt < 275;
            if (!isRapidSecondClick) return;
            if (!e.target?.closest) return;
            if (e.target.closest('.suggestions-list') || e.target.closest('.suggestion-item') || e.target.closest('.suggestions-heading')) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);

        searchBoxWrapper.addEventListener('click', (e) => {
            const now = Date.now();
            if (now - lastPrimaryUiClickAt < 275) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            lastPrimaryUiClickAt = now;
            // Don't focus if clicking on a button
            if (e.target.closest('.search-switcher-button') || e.target.closest('.search-button') || e.target.closest('.search-url-button')) {
                return;
            }
            searchInput.focus();
        });

        // Handle search switcher button dropdown
        if (searchSwitcherButton) {
        const searchSwitcherDropdown = searchSwitcherButton.querySelector('.search-switcher-dropdown');
        const resetSwitcherScrollPositions = () => {
            // The prototype now uses a single combined scrollbar container.
            const scrollContainers = [
                searchSwitcherButton.querySelector('.dropdown-engines-firefox-scroll'),
                searchSwitcherButton.querySelector('.dropdown-search-engines'),
                searchSwitcherButton.querySelector('.dropdown-firefox-suggestions')
            ].filter(Boolean);
            scrollContainers.forEach((el) => {
                try {
                    const prev = el.style.scrollBehavior;
                    el.style.scrollBehavior = 'auto';
                    el.scrollTop = 0;
                    el.scrollLeft = 0;
                    // Force style flush so we don't "animate back" when scroll-behavior is smooth in CSS.
                    void el.offsetHeight;
                    el.style.scrollBehavior = prev;
                } catch (_) {}
            });
        };
        const setSwitcherDropdownMaxHeight = () => {
            const dropdown = searchSwitcherButton.querySelector('.search-switcher-dropdown');
            if (!dropdown) return;
            const dropdownRect = dropdown.getBoundingClientRect();
            const isInIframe = window !== window.top;
            const viewportH = isInIframe && parentViewportInfo ? parentViewportInfo.viewportH : window.innerHeight;
            const frameTop = isInIframe && parentViewportInfo ? parentViewportInfo.frameTop : 0;
            const dropdownTopInViewport = isInIframe && parentViewportInfo ? (frameTop + dropdownRect.top) : dropdownRect.top;
            const bottomPadding = 8;
            const available = Math.floor(viewportH - dropdownTopInViewport - bottomPadding);
            // Never allow the dropdown to extend past viewport bottom.
            const clamped = Math.max(0, available);
            dropdown.style.setProperty('--switcher-dropdown-max-height', clamped + 'px');
        };
        // On load/reset we want the switcher scroll already at the top (no visible jump when opened).
        resetSwitcherScrollPositions();

        // Sync inert / max-height even when the switcher opens via keyboard or other paths.
        const switcherDropdownEl = searchSwitcherButton.querySelector('.search-switcher-dropdown');
        const syncSwitcherDropdownInert = () => {
            if (!switcherDropdownEl) return;
            if (searchSwitcherButton.classList.contains('open')) {
                switcherDropdownEl.removeAttribute('inert');
            } else {
                switcherDropdownEl.setAttribute('inert', '');
            }
        };
        if (typeof MutationObserver !== 'undefined') {
            let wasSwitcherOpen = searchSwitcherButton.classList.contains('open');
            new MutationObserver(() => {
                searchSwitcherButton.setAttribute(
                    'aria-expanded',
                    searchSwitcherButton.classList.contains('open') ? 'true' : 'false'
                );
                syncSwitcherDropdownInert();
                const nowOpen = searchSwitcherButton.classList.contains('open');
                if (nowOpen) {
                    setSwitcherDropdownMaxHeight();
                    /* Other classes on this node can change while already open; log only on closed → open. */
                    if (!wasSwitcherOpen) {
                        logSearchSwitcherOpenedDefault(searchSwitcherButton);
                        logSearchEngineDefaultSync('search-switcher-opened', searchSwitcherButton);
                    }
                } else if (document.body.classList.contains('reduced-motion')) {
                    /* No max-height transition: safe to drop width immediately. */
                    switcherDropdownEl?.style.removeProperty('width');
                }
                wasSwitcherOpen = nowOpen;
                /* Otherwise keep inline width until .search-switcher-dropdown transitionend (max-height). */
            }).observe(searchSwitcherButton, { attributes: true, attributeFilter: ['class'] });

            // Keep parent iframe height in sync even when switcher closes via non-click paths
            // (e.g. parent "close-switcher" message, outside click, keyboard close).
            if (window !== window.top) {
                new MutationObserver(() => {
                    try {
                        window.parent.postMessage(
                            { type: 'switcher-open-state', open: searchSwitcherButton.classList.contains('open') },
                            '*'
                        );
                    } catch (_) {}
                }).observe(searchSwitcherButton, { attributes: true, attributeFilter: ['class'] });
            }

            if (switcherDropdownEl) {
                new MutationObserver(() => {
                    if (switcherDropdownEl.classList.contains('dropdown-revealed')) {
                        setSwitcherDropdownMaxHeight();
                        syncSearchSwitcherDropdownWidth();
                    }
                }).observe(switcherDropdownEl, { attributes: true, attributeFilter: ['class'] });
            }
        }
        syncSwitcherDropdownInert();

        window.addEventListener('resize', () => {
            if (searchSwitcherButton.classList.contains('open')) {
                setSwitcherDropdownMaxHeight();
                syncSearchSwitcherDropdownWidth();
            }
        });

            searchSwitcherButton.addEventListener('mousedown', (e) => {
                // Native <select> needs default mousedown to open; preventDefault would block it.
                if (e.target?.closest?.('select')) return;
                e.preventDefault(); // Prevent input from blurring
            });

            searchSwitcherButton.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                searchSwitcherButton.click();
            });

            searchSwitcherButton.addEventListener('click', (e) => {
                const now = Date.now();
                if (now - lastPrimaryUiClickAt < 275) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                lastPrimaryUiClickAt = now;
                e.stopPropagation();
                const clickedInsideDropdown = e.target.closest('.search-switcher-dropdown');
                const wasOpen = searchSwitcherButton.classList.contains('open');
                if (clickedInsideDropdown) {
                    console.log('[SWITCHER BUTTON CLICK] Ignoring - click was inside dropdown (already handled by dropdown)');
                    return;
                }
                /* Apply slower max-height transition *before* removing .open so collapse uses ~0.55s, not 0.25s. */
                if (wasOpen) {
                    searchSwitcherDropdown?.classList.add('switcher-dropdown--closing');
                } else {
                    searchSwitcherDropdown?.classList.remove('switcher-dropdown--closing');
                }
                searchSwitcherButton.classList.toggle('open');
                const isNowOpen = searchSwitcherButton.classList.contains('open');
                const isInIframe = window !== window.top;
                if (isInIframe) {
                    try {
                        window.parent.postMessage({ type: 'switcher-open-state', open: isNowOpen }, '*');
                    } catch (_) {}
                }
                if (wasOpen && !isNowOpen) {
                    forceCloseSearchSwitcherSubPanels();
                    beginSwitcherClosingShapeHoldUntilDropdownAnimation(searchSwitcherButton);
                    searchSwitcherDropdown?.classList.remove('dropdown-revealed');
                    switcherHighlightedIndex = -1;
                    searchSwitcherButton.classList.remove('switcher-suppress-hover');
                    searchSwitcherButton.querySelectorAll('.dropdown-item').forEach(item => item.classList.remove('highlighted'));
                    if (searchContainer?.classList.contains('focused')) {
                        restoreFocusAndOpaqueSuggestions();
                    }
                } else if (!wasOpen && isNowOpen) {
                    searchSwitcherButton.classList.remove('switcher-opened-by-keyboard');
                    searchSwitcherDropdown?.classList.remove('dropdown-revealed');
                    if (isInIframe) {
                        try {
                            window.parent.postMessage({ type: 'switcher-request-viewport' }, '*');
                        } catch (_) {}
                    }
                    setSwitcherDropdownMaxHeight();
                    setTimeout(setSwitcherDropdownMaxHeight, 0);
                    requestAnimationFrame(setSwitcherDropdownMaxHeight);
                    requestAnimationFrame(() => requestAnimationFrame(setSwitcherDropdownMaxHeight));
                    resetSwitcherScrollPositions();
                    const onRevealed = (e) => {
                        if (e.propertyName !== 'max-height') return;
                        searchSwitcherDropdown.removeEventListener('transitionend', onRevealed);
                        if (searchSwitcherButton.classList.contains('open')) {
                            searchSwitcherDropdown.classList.add('dropdown-revealed');
                            syncSearchSwitcherDropdownWidth();
                            requestAnimationFrame(() => syncSearchSwitcherDropdownWidth());
                        // Log final geometry once revealed (no expansion required in console).
                        const dropdown = searchSwitcherButton.querySelector('.search-switcher-dropdown');
                        const dropdownRect = dropdown?.getBoundingClientRect();
                        const isInIframe = window !== window.top;
                        const viewportH = isInIframe && parentViewportInfo ? parentViewportInfo.viewportH : window.innerHeight;
                        const frameTop = isInIframe && parentViewportInfo ? parentViewportInfo.frameTop : 0;
                        const bottom = dropdownRect
                            ? Math.round((isInIframe && parentViewportInfo ? (frameTop + dropdownRect.top) : dropdownRect.top) + dropdown.scrollHeight)
                            : null;
                        }
                    };
                    searchSwitcherDropdown?.addEventListener('transitionend', onRevealed);
                    searchInput.blur();
                    try {
                        searchSwitcherButton.focus({ focusVisible: false });
                    } catch (_) {
                        searchSwitcherButton.focus();
                    }
                    searchSwitcherButton.classList.add('switcher-suppress-hover');
                }
            });
        }
    }

    // Delegated click handler for suggestion items (handles static defaults + dynamic items)
    const suggestionsContent = document.querySelector('.suggestions-content');
    if (suggestionsContent) {
        suggestionsContent.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-item:not(.skeleton)');
            if (!item || item.classList.contains('gmail-item-hidden')) return;
            if (item.classList.contains('gmail-item')) return; // Gmail has its own handling
            const suggestion = item.querySelector('.suggestion-label')?.textContent?.trim() || '';
            if (!suggestion) return;
            if (item.classList.contains('firefox-suggest-item')) {
                const ffType = item.getAttribute('data-firefox-type') || '';
                if (ffType === 'recommendations' || ffType === 'partners') return;
            }
            if (item.classList.contains('local-source-suggestion')) {
                const dropdown = searchSwitcherButton?.querySelector('.search-switcher-dropdown');
                const engineItem = dropdown ? Array.from(dropdown.querySelectorAll('.dropdown-item')).find(el => el.textContent.trim() === suggestion) : null;
                if (engineItem) {
                    applySelectedSearchSource(engineItem);
                    if (searchInput) {
                        searchInput.value = '';
                        suggestionsList?.classList.add('suggestions-suppress-until-typed');
                        updateSuggestions([]);
                        searchInput.focus();
                    }
                }
                return;
            }
            if (item.classList.contains('visit-site-suggestion') && looksLikeUrl(suggestion)) {
                const url = suggestion.trim();
                const toOpen = /^https?:\/\//i.test(url) ? url : 'https://' + url;
                window.top.open(toOpen, '_blank');
                return;
            }
            if (!item.classList.contains('firefox-suggest-item')) {
                saveToSearchHistory(suggestion);
                runSearchWithSelectedEngine(suggestion);
            }
        });
    }

    // Close switcher dropdown when hovering over suggestion items or headings
    if (suggestionsList && searchSwitcherButton) {
        // Delegate to handle both existing items and any future items
        suggestionsList.addEventListener('mouseover', (e) => {
            if (document.body.classList.contains('switcher-outside-search-box-enabled')) return;
            const target = e.target.closest('.suggestion-item, .suggestions-heading');
            const switcherTooltipPinned = tooltipPinned && activeTrigger?.closest('.search-switcher-dropdown');
            if (target && searchSwitcherButton.classList.contains('open') && !switcherTooltipPinned && !window._searchEngineDragging) {
                console.log('[SUGGESTION ITEM HOVER] Closing switcher dropdown');
                forceCloseSearchSwitcherSubPanels();
                searchSwitcherButton.querySelector('.search-switcher-dropdown')?.classList.remove('dropdown-revealed');
                beginSwitcherClosingShapeHoldUntilDropdownAnimation(searchSwitcherButton);
                searchSwitcherButton.classList.remove('open', 'switcher-suppress-hover');
                switcherHighlightedIndex = -1;
                searchSwitcherButton.querySelectorAll('.dropdown-item').forEach(item => item.classList.remove('highlighted'));
                restoreFocusAndOpaqueSuggestions();
            }
        });
    }
    
    // Handle search switcher button dropdown
    if (searchSwitcherButton) {
        // When mousedown on search container (not switcher) with switcher open, focus will move to input
        document.addEventListener('mousedown', (e) => {
            if (searchSwitcherButton?.classList.contains('open') &&
                e.target.closest('.search-container') &&
                !e.target.closest('.search-switcher-button')) {
                if (searchContainer?.classList.contains('focused')) {
                    restoringFocusFromSwitcher = true;
                } else {
                    closingSwitcherWithoutSuggestions = true;
                }
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (window._searchEngineDragOccurred) {
                window._searchEngineDragOccurred = false;
                if (!e.target.closest?.('.search-switcher-button')) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                return;
            }
            /* Trailing click after default-badge drag (mouseup outside switcher) must not close */
            if (window._defaultBadgeDragJustEnded) {
                window._defaultBadgeDragJustEnded = false;
                if (!e.target.closest?.('.search-switcher-button')) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                return;
            }
            if (document.body.classList.contains('switcher-outside-search-box-enabled')) {
                // When pinned, keep it open while interacting with the search UI,
                // but clicking away from the search UI should close switcher + suggestions (blur input).
                if (searchContainer?.classList.contains('focused')) {
                    const clickInsideSearch = e.target.closest?.('.search-container');
                    if (clickInsideSearch) {
                        return;
                    }
                }
            }
            // Prototype options live only on the main page; keep switcher open while changing settings.
            if (window === window.top && e.target.closest?.('.bottom-left-panel')) {
                return;
            }
            if (!e.target.closest('.search-switcher-button')) {
                const wasOpen = searchSwitcherButton.classList.contains('open');
                if (wasOpen) {
                    beginSwitcherClosingShapeHoldUntilDropdownAnimation(searchSwitcherButton);
                    searchSwitcherButton.classList.remove('switcher-opened-by-keyboard');
                    searchSwitcherButton.querySelector('.search-switcher-dropdown')?.classList.remove('dropdown-revealed');
                    switcherHighlightedIndex = -1;
                    searchSwitcherButton.classList.remove('switcher-suppress-hover');
                    searchSwitcherButton.querySelectorAll('.dropdown-item').forEach(item => item.classList.remove('highlighted'));
                    if (searchContainer?.classList.contains('focused')) {
                        const clickInsideSearch = e.target.closest('.search-container');
                        if (clickInsideSearch) {
                            restoreFocusAndOpaqueSuggestions();
                        } else {
                            closeSuggestionsPanel();
                            try { searchInput?.blur?.(); } catch (_) {}
                        }
                    }
                    restoringFocusFromSwitcher = false;
                    closingSwitcherWithoutSuggestions = false;
                }
                forceCloseSearchSwitcherSubPanels();
                searchSwitcherButton.classList.remove('open');
            }
        });
        
        // Clear keyboard highlight when mouse enters dropdown (switch to hover mode)
        const searchSwitcherDropdown = searchSwitcherButton.querySelector('.search-switcher-dropdown');
        if (searchSwitcherDropdown) {
            searchSwitcherDropdown.addEventListener(
                'mousedown',
                (e) => {
                    const badgeDragSurface = {
                        surface: getDefaultSearchEngineSurfaceLabel(),
                        writesToLocalStorageKey: getDefaultSearchEngineStorageKeyForPage(),
                    };
                    const onPinnedRow = e.target.closest?.('.dropdown-item-pinned');
                    if (onPinnedRow) {
                        defaultBadgeDragLog('mousedown on pinned row', {
                            ...badgeDragSurface,
                            target: e.target?.tagName,
                            className: e.target?.className,
                            closestDraggable: !!e.target.closest?.('.dropdown-default-badge--draggable'),
                            badgeWrapPresent: !!onPinnedRow.querySelector?.('.dropdown-default-badge-wrap'),
                        });
                    }
                    const badgeEl = e.target.closest('.dropdown-default-badge--draggable');
                    if (!badgeEl) {
                        return;
                    }
                    const dragEl = badgeEl.querySelector('.dropdown-default-badge-drag');
                    if (!dragEl) {
                        defaultBadgeDragLog('drag abort — badge has no .dropdown-default-badge-drag', badgeDragSurface);
                        return;
                    }
                    if (document.body.classList.contains('pin-default-enabled')) {
                        defaultBadgeDragLog('drag abort — pin-default-enabled', badgeDragSurface);
                        return;
                    }
                    if (!searchSwitcherButton.classList.contains('search-engines-controls-open')) {
                        return;
                    }
                    const enginesContainer = searchSwitcherButton.querySelector('.dropdown-search-engines');
                    const pinnedItem = enginesContainer?.querySelector('.dropdown-item-pinned');
                    if (!pinnedItem || !enginesContainer || !pinnedItem.contains(badgeEl)) {
                        defaultBadgeDragLog('drag abort — badge not inside pinned row / engines', {
                            ...badgeDragSurface,
                            hasPinned: !!pinnedItem,
                            hasEngines: !!enginesContainer,
                            contains: pinnedItem?.contains?.(badgeEl),
                        });
                        return;
                    }
                    defaultBadgeDragLog('drag start', badgeDragSurface);
                    e.preventDefault();
                    e.stopPropagation();
                    const floatWrap = badgeEl.closest('.dropdown-default-badge-wrap');
                    if (!floatWrap) return;
                    const wrapRect = floatWrap.getBoundingClientRect();
                    const dragOffsetX = e.clientX - wrapRect.left;
                    const dragOffsetY = e.clientY - wrapRect.top;
                    window._defaultBadgeDragging = true;
                    document.body.classList.add('default-badge-dragging');
                    floatWrap.style.width = `${wrapRect.width}px`;
                    floatWrap.classList.add('default-badge-drag-float');
                    badgeEl.classList.add('dropdown-default-badge--dragging');
                    dragEl.classList.add('dropdown-default-badge-drag--dragging');
                    const placeholderEl = document.createElement('span');
                    placeholderEl.className = 'dropdown-default-badge-placeholder';
                    placeholderEl.setAttribute('aria-hidden', 'true');
                    placeholderEl.style.width = `${wrapRect.width}px`;
                    placeholderEl.style.height = `${wrapRect.height}px`;
                    floatWrap.parentNode.insertBefore(placeholderEl, floatWrap);
                    document.body.appendChild(floatWrap);
                    floatWrap.style.left = `${e.clientX - dragOffsetX}px`;
                    floatWrap.style.top = `${e.clientY - dragOffsetY}px`;
                    const ghostEl = document.createElement('div');
                    ghostEl.className = 'default-badge-drop-ghost';
                    ghostEl.setAttribute('aria-hidden', 'true');
                    document.body.appendChild(ghostEl);
                    const prevCursor = document.body.style.cursor;
                    const prevUserSelect = document.body.style.userSelect;
                    document.body.style.cursor = 'grabbing';
                    document.body.style.userSelect = 'none';
                    let badgeDragScrollInterval = null;
                    const clearHighlight = () => {
                        enginesContainer.querySelectorAll('.dropdown-item').forEach((el) => el.classList.remove('highlighted'));
                        ghostEl.style.display = 'none';
                    };
                    /** Resolve engine row under cursor; skips floating badge + ghost so the source (pinned) row stays a valid drop target. */
                    const findEngineRowUnderPoint = (clientX, clientY) => {
                        const stack = document.elementsFromPoint(clientX, clientY);
                        for (let i = 0; i < stack.length; i++) {
                            const node = stack[i];
                            if (!node || typeof node.closest !== 'function') continue;
                            if (node === floatWrap || floatWrap.contains(node)) continue;
                            if (node === ghostEl || ghostEl.contains(node)) continue;
                            const row = node.closest('.dropdown-item');
                            if (
                                row &&
                                enginesContainer.contains(row) &&
                                row.querySelector('.dropdown-engine-label')
                            ) {
                                return row;
                            }
                        }
                        return null;
                    };
                    const highlightUnder = (clientX, clientY) => {
                        clearHighlight();
                        const item = findEngineRowUnderPoint(clientX, clientY);
                        if (!item) return;
                        item.classList.add('highlighted');
                        const labelEl = item.querySelector('.dropdown-engine-label');
                        if (!labelEl) return;
                        const lr = labelEl.getBoundingClientRect();
                        ghostEl.style.display = 'block';
                        ghostEl.style.width = `${wrapRect.width}px`;
                        ghostEl.style.height = `${wrapRect.height}px`;
                        ghostEl.style.left = `${lr.right + 8}px`;
                        ghostEl.style.top = `${lr.top + (lr.height - wrapRect.height) / 2}px`;
                    };
                    const BADGE_DRAG_SCROLL_ZONE = 36;
                    const BADGE_DRAG_SCROLL_SPEED = 8;
                    const onMove = (ev) => {
                        if (!window._defaultBadgeDragging) return;
                        floatWrap.style.left = `${ev.clientX - dragOffsetX}px`;
                        floatWrap.style.top = `${ev.clientY - dragOffsetY}px`;
                        highlightUnder(ev.clientX, ev.clientY);
                        const scrollEl = getEngineListScrollEl(enginesContainer);
                        if (badgeDragScrollInterval) {
                            clearInterval(badgeDragScrollInterval);
                            badgeDragScrollInterval = null;
                        }
                        if (scrollEl) {
                            const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
                            if (maxScroll > 0) {
                                const cr = scrollEl.getBoundingClientRect();
                                const distFromTop = ev.clientY - cr.top;
                                const distFromBottom = cr.bottom - ev.clientY;
                                if (distFromTop < BADGE_DRAG_SCROLL_ZONE && distFromTop >= 0 && scrollEl.scrollTop > 0) {
                                    badgeDragScrollInterval = setInterval(() => {
                                        if (scrollEl.scrollTop <= 0) {
                                            clearInterval(badgeDragScrollInterval);
                                            badgeDragScrollInterval = null;
                                            return;
                                        }
                                        scrollEl.scrollTop -= BADGE_DRAG_SCROLL_SPEED;
                                    }, 16);
                                } else if (
                                    distFromBottom < BADGE_DRAG_SCROLL_ZONE &&
                                    distFromBottom >= 0 &&
                                    scrollEl.scrollTop < maxScroll
                                ) {
                                    badgeDragScrollInterval = setInterval(() => {
                                        if (scrollEl.scrollTop >= maxScroll) {
                                            clearInterval(badgeDragScrollInterval);
                                            badgeDragScrollInterval = null;
                                            return;
                                        }
                                        scrollEl.scrollTop += BADGE_DRAG_SCROLL_SPEED;
                                    }, 16);
                                }
                            }
                        }
                    };
                    highlightUnder(e.clientX, e.clientY);
                    const onUp = (ev) => {
                        if (!window._defaultBadgeDragging) return;
                        window._defaultBadgeDragging = false;
                        if (badgeDragScrollInterval) {
                            clearInterval(badgeDragScrollInterval);
                            badgeDragScrollInterval = null;
                        }
                        document.body.classList.remove('default-badge-dragging');
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                        document.body.style.cursor = prevCursor;
                        document.body.style.userSelect = prevUserSelect;
                        ghostEl.remove();
                        floatWrap.remove();
                        placeholderEl.remove();
                        const item = findEngineRowUnderPoint(ev.clientX, ev.clientY);
                        clearHighlight();
                        const willApply =
                            item &&
                            enginesContainer.contains(item) &&
                            item.querySelector('.dropdown-engine-label') &&
                            item !== pinnedItem;
                        defaultBadgeDragLog('drag end (mouseup)', {
                            ...badgeDragSurface,
                            x: ev.clientX,
                            y: ev.clientY,
                            resolvedItem: item ? getEngineLabel(item) : null,
                            willApplyNewDefault: !!willApply,
                        });
                        if (willApply) {
                            const label = getEngineLabel(item);
                            if (label) {
                                applySelectedSearchSource(item);
                                setDefaultSearchEngineStorageItem(getDefaultSearchEngineStorageKeyForPage(), label);
                                setPinnedEngine(item);
                                syncSearchSettingsDefaultEngineSelects();
                                notifyParentDefaultSearchEngineChanged();
                                defaultBadgeDragLog('applied new default', {
                                    ...badgeDragSurface,
                                    engineLabel: label,
                                });
                            } else {
                                updateDefaultBadge();
                            }
                        } else {
                            updateDefaultBadge();
                        }
                        window._defaultBadgeDragJustEnded = true;
                        setTimeout(() => {
                            window._defaultBadgeDragJustEnded = false;
                        }, 750);
                    };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                },
                true
            );
            searchSwitcherDropdown.addEventListener('mousemove', () => {
                if (searchSwitcherButton.classList.contains('switcher-suppress-hover')) {
                    searchSwitcherButton.classList.remove('switcher-suppress-hover');
                }
            });
            searchSwitcherDropdown.addEventListener('mouseover', (e) => {
                if (window._defaultBadgeDragging) return;
                const item = e.target.closest('.dropdown-item');
                if (item) {
                    const dropdown = searchSwitcherButton.querySelector('.search-switcher-dropdown');
                    const items = dropdown ? Array.from(dropdown.querySelectorAll('.dropdown-item')) : [];
                    switcherHoveredIndex = items.indexOf(item);
                    switcherHighlightedIndex = -1;
                    searchSwitcherButton.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('highlighted'));
                }
            });
            searchSwitcherDropdown.addEventListener('mouseleave', () => {
                switcherHoveredIndex = -1;
            });
            searchSwitcherDropdown.addEventListener('click', (e) => {
                if (window._searchEngineDragOccurred) {
                    window._searchEngineDragOccurred = false;
                    return;
                }
                if (window._defaultBadgeDragJustEnded) {
                    window._defaultBadgeDragJustEnded = false;
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                const firefoxToggleEl = e.target.closest('.dropdown-firefox-toggle');
                if (firefoxToggleEl) {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFirefoxSuggestionCheckbox(firefoxToggleEl);
                    return;
                }
                const openNewTabBtn = e.target.closest('.dropdown-item-open-new-window');
                if (openNewTabBtn) {
                    const item = openNewTabBtn.closest('.dropdown-item');
                    const label = item ? getEngineLabel(item) : '';
                    const query = (searchInput?.value || '').trim();
                    if (label && query) {
                        e.preventDefault();
                        e.stopPropagation();
                        runSearchWithEngine(query, label, false);
                    }
                    const pinnedOpen = document.body.classList.contains('switcher-outside-search-box-enabled');
                    if (!pinnedOpen) {
                        forceCloseSearchSwitcherSubPanels();
                        searchSwitcherDropdown.classList.remove('dropdown-revealed');
                        beginSwitcherClosingShapeHoldUntilDropdownAnimation(searchSwitcherButton);
                        searchSwitcherButton.classList.remove('open', 'switcher-suppress-hover');
                    }
                    switcherHighlightedIndex = -1;
                    searchSwitcherButton.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('highlighted'));
                    if (searchContainer?.classList.contains('focused')) restoreFocusAndOpaqueSuggestions();
                    return;
                }
                const item = e.target.closest('.dropdown-item');
                const pinEl = e.target.closest('.dropdown-item-pin-empty, .dropdown-item-pin');
                if (pinEl) {
                    const item = pinEl.closest('.dropdown-item');
                    if (item && item.querySelector('.dropdown-engine-label') && document.body.classList.contains('pin-default-enabled')) {
                        e.stopPropagation();
                        applySelectedSearchSource(item);
                        const label = getEngineLabel(item);
                        if (label) setDefaultSearchEngineStorageItem(getDefaultSearchEngineStorageKeyForPage(), label);
                        setPinnedEngine(item);
                        syncSearchSettingsDefaultEngineSelects();
                        notifyParentDefaultSearchEngineChanged();
                        const pinnedOpen = document.body.classList.contains('switcher-outside-search-box-enabled');
                        if (!pinnedOpen) {
                            forceCloseSearchSwitcherSubPanels();
                            searchSwitcherDropdown.classList.remove('dropdown-revealed');
                            beginSwitcherClosingShapeHoldUntilDropdownAnimation(searchSwitcherButton);
                            searchSwitcherButton.classList.remove('open', 'switcher-suppress-hover');
                        }
                        switcherHighlightedIndex = -1;
                        searchSwitcherButton.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('highlighted'));
                        if (searchContainer?.classList.contains('focused')) restoreFocusAndOpaqueSuggestions();
                        return;
                    }
                }
                if (!item) return;
                if (item.id === 'quick-buttons-toggle') return;
                console.log('[SWITCHER MOUSE] Dropdown item clicked, applying selection and closing');
                const query = (searchInput?.value || '').trim();
                const isEngineItem = !!item.querySelector('.dropdown-engine-label');
                const openInBackground = (e.metaKey || e.ctrlKey) && isEngineItem && !!query;
                if (openInBackground) {
                    runSearchWithEngine(query, getEngineLabel(item), false);
                } else {
                    applySelectedSearchSource(item);
                    if (isEngineItem && query) {
                        runSearchWithEngine(query, getEngineLabel(item), true);
                    }
                }
                const pinnedOpen = document.body.classList.contains('switcher-outside-search-box-enabled');
                if (!pinnedOpen) {
                    forceCloseSearchSwitcherSubPanels();
                    searchSwitcherDropdown.classList.remove('dropdown-revealed');
                    beginSwitcherClosingShapeHoldUntilDropdownAnimation(searchSwitcherButton);
                    searchSwitcherButton.classList.remove('open', 'switcher-suppress-hover');
                }
                switcherHighlightedIndex = -1;
                searchSwitcherButton.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('highlighted'));
                if (searchContainer?.classList.contains('focused')) {
                    restoreFocusAndOpaqueSuggestions();
                } else if (searchSwitcherButton?.contains(document.activeElement)) {
                    document.activeElement?.blur?.();
                }
                console.log('[SWITCHER MOUSE] Closed. Open state now:', searchSwitcherButton.classList.contains('open'));
            });
            restoreFirefoxSuggestionsState();
        }

        // Drag-and-drop reorder for search engines
        const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        if (enginesContainer) {
            let dragHoldTimer = null;
            let draggedItem = null;
            let dragOffsetX = 0, dragOffsetY = 0;
            let dropMarker = null;
            let dropIndex = -1;
            let dragScrollInterval = null;
            let dragOriginalIndex = -1;

            const getEngineItems = () => Array.from(enginesContainer.children).filter(
                c => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
            );

            const isGridMode = () => document.body.classList.contains('search-engines-display-grid');

            const getDropIndexFromY = (clientY) => {
                const items = getEngineItems();
                if (items.length === 0) return 0;
                const scrollEl = getEngineListScrollEl(enginesContainer);
                const viewportRect = scrollEl.getBoundingClientRect();
                if (clientY < viewportRect.top) return 0;
                if (clientY > viewportRect.bottom) return items.length;
                const rows = Array.from(enginesContainer.children).filter(
                    c => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
                );
                for (let i = 0; i < rows.length; i++) {
                    const rect = rows[i].getBoundingClientRect();
                    const mid = rect.top + rect.height / 2;
                    if (clientY < mid) {
                        const engineIndex = rows.slice(0, i).filter(r => r.classList.contains('dropdown-item')).length;
                        return engineIndex;
                    }
                }
                return items.length;
            };

            const getGridDrop = (clientX, clientY) => {
                const items = getEngineItems();
                if (items.length === 0) return { index: 0, marker: null };

                const scrollEl = getEngineListScrollEl(enginesContainer);
                const viewportRect = scrollEl.getBoundingClientRect();
                const ecRect = enginesContainer.getBoundingClientRect();
                const visible = items
                    .map((el, idx) => ({ el, idx, rect: el.getBoundingClientRect() }))
                    .filter(r => r.rect.width > 0 && r.rect.height > 0);
                if (!visible.length) return { index: 0, marker: null };

                // Clamp point into the visible scroll viewport so edge drags still pick a tile.
                const x = Math.min(Math.max(clientX, viewportRect.left), viewportRect.right);
                const y = Math.min(Math.max(clientY, viewportRect.top), viewportRect.bottom);

                let closest = visible[0];
                let best = Infinity;
                for (const v of visible) {
                    const cx = v.rect.left + v.rect.width / 2;
                    const cy = v.rect.top + v.rect.height / 2;
                    const dx = x - cx;
                    const dy = y - cy;
                    const d = dx * dx + dy * dy;
                    if (d < best) {
                        best = d;
                        closest = v;
                    }
                }

                const midX = closest.rect.left + closest.rect.width / 2;
                const insertAfter = x > midX;
                const index = closest.idx + (insertAfter ? 1 : 0);

                // Marker positioned between tiles, in engines-container coordinates.
                const markerX = (insertAfter ? closest.rect.right : closest.rect.left) - ecRect.left;
                const markerY = closest.rect.top - ecRect.top;
                const markerH = closest.rect.height;
                return { index, marker: { x: markerX, y: markerY, h: markerH } };
            };

            const updateDropMarker = (index) => {
                const items = getEngineItems();
                if (index < 0 || index > items.length) return;
                if (!dropMarker) {
                    dropMarker = document.createElement('div');
                    dropMarker.className = 'dropdown-drop-marker';
                    dropMarker.setAttribute('aria-hidden', 'true');
                }
                if (dropIndex === index) return;
                dropIndex = index;
                const sortSectionForMarker = enginesContainer.querySelector('.engines-sort-section');
                if (!isGridMode()) {
                    dropMarker.className = 'dropdown-drop-marker';
                    dropMarker.style.left = '';
                    dropMarker.style.top = '';
                    dropMarker.style.height = '';
                    if (index >= items.length) {
                        enginesContainer.insertBefore(dropMarker, sortSectionForMarker || null);
                    } else {
                        enginesContainer.insertBefore(dropMarker, items[index]);
                    }
                    return;
                }

                // Grid mode: overlay a vertical bar between icon tiles (don’t consume a grid cell).
                dropMarker.className = 'dropdown-drop-marker dropdown-drop-marker-grid';
                if (dropMarker.parentNode !== enginesContainer) {
                    enginesContainer.appendChild(dropMarker);
                }
                // Position is set by onDragMove using getGridDrop().
            };

            const endDrag = () => {
                if (!draggedItem) return;
                document.removeEventListener('mousemove', onDragMove);
                document.removeEventListener('mouseup', onDragEnd);
                document.removeEventListener('mouseleave', onDragEnd);
                if (dragScrollInterval) {
                    clearInterval(dragScrollInterval);
                    dragScrollInterval = null;
                }
                enginesContainer.classList.remove('engines-dragging');
                window._searchEngineDragging = false;

                const items = getEngineItems();
                const currentIndex = dragOriginalIndex;
                const sortSectionEl = enginesContainer.querySelector('.engines-sort-section');
                const wouldChange = dropIndex >= 0 && dropIndex !== currentIndex && dropIndex !== currentIndex + 1;
                if (wouldChange) {
                    if (dropIndex >= items.length) {
                        enginesContainer.insertBefore(draggedItem, sortSectionEl || null);
                    } else {
                        enginesContainer.insertBefore(draggedItem, items[dropIndex]);
                    }
                } else {
                    if (currentIndex >= items.length) {
                        enginesContainer.insertBefore(draggedItem, sortSectionEl || null);
                    } else {
                        enginesContainer.insertBefore(draggedItem, items[currentIndex]);
                    }
                }
                if (dropMarker?.parentNode) dropMarker.remove();
                draggedItem.classList.remove('dragging');
                draggedItem.style.left = '';
                draggedItem.style.top = '';
                draggedItem.style.width = '';
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                saveEngineOrder();
                draggedItem = null;
                dropMarker = null;
                dropIndex = -1;
                window._searchEngineDragOccurred = true;
            };

            const DRAG_SCROLL_ZONE = 36;
            const DRAG_SCROLL_SPEED = 8;

            const onDragMove = (e) => {
                if (!draggedItem) return;
                draggedItem.style.left = (e.clientX - dragOffsetX) + 'px';
                draggedItem.style.top = (e.clientY - dragOffsetY) + 'px';
                if (isGridMode()) {
                    const grid = getGridDrop(e.clientX, e.clientY);
                    updateDropMarker(grid.index);
                    if (dropMarker && grid.marker) {
                        dropMarker.style.left = grid.marker.x + 'px';
                        dropMarker.style.top = grid.marker.y + 'px';
                        dropMarker.style.height = grid.marker.h + 'px';
                    }
                } else {
                    updateDropMarker(getDropIndexFromY(e.clientY));
                }

                const scrollEl = getEngineListScrollEl(enginesContainer);
                const containerRect = scrollEl.getBoundingClientRect();
                const distFromTop = e.clientY - containerRect.top;
                const distFromBottom = containerRect.bottom - e.clientY;
                const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;

                if (dragScrollInterval) {
                    clearInterval(dragScrollInterval);
                    dragScrollInterval = null;
                }
                if (maxScroll > 0 && distFromTop < DRAG_SCROLL_ZONE && distFromTop >= 0 && scrollEl.scrollTop > 0) {
                    dragScrollInterval = setInterval(() => {
                        if (scrollEl.scrollTop <= 0) {
                            clearInterval(dragScrollInterval);
                            dragScrollInterval = null;
                            return;
                        }
                        scrollEl.scrollTop -= DRAG_SCROLL_SPEED;
                    }, 16);
                } else if (
                    maxScroll > 0 &&
                    distFromBottom < DRAG_SCROLL_ZONE &&
                    distFromBottom >= 0 &&
                    scrollEl.scrollTop < maxScroll
                ) {
                    dragScrollInterval = setInterval(() => {
                        if (scrollEl.scrollTop >= maxScroll) {
                            clearInterval(dragScrollInterval);
                            dragScrollInterval = null;
                            return;
                        }
                        scrollEl.scrollTop += DRAG_SCROLL_SPEED;
                    }, 16);
                }
            };

            const onDragEnd = () => {
                endDrag();
            };

            enginesContainer.addEventListener('mousedown', (e) => {
                const item = e.target.closest('.dropdown-item');
                if (!item || !item.querySelector('.dropdown-engine-label')) return;
                /* Reorder drag only while the controls panel is open (drag handles are shown then). */
                if (!searchSwitcherButton.classList.contains('search-engines-controls-open')) return;
                if (e.target.closest('.dropdown-item-pin-empty, .dropdown-item-pin, .dropdown-item-open-new-window, .dropdown-item-row-action')) return;
                e.preventDefault();

                const rect = item.getBoundingClientRect();
                const anchorEl = ['.dropdown-item-drag-handle', '.dropdown-item-pin-empty', '.dropdown-item-pin']
                    .map(sel => item.querySelector(sel))
                    .find(el => el && el.getBoundingClientRect().width > 0);
                if (anchorEl) {
                    const anchorRect = anchorEl.getBoundingClientRect();
                    dragOffsetX = (anchorRect.left - rect.left) - 20;
                    dragOffsetY = (anchorRect.top - rect.top) + anchorRect.height / 2;
                } else {
                    const iconEl = item.querySelector('.dropdown-engine-icon, .dropdown-icon');
                    if (iconEl) {
                        const iconRect = iconEl.getBoundingClientRect();
                        dragOffsetX = (iconRect.left - rect.left) + iconRect.width / 2;
                        dragOffsetY = (iconRect.top - rect.top) + iconRect.height / 2;
                    } else {
                        dragOffsetX = e.clientX - rect.left;
                        dragOffsetY = e.clientY - rect.top;
                    }
                }

                dragHoldTimer = setTimeout(() => {
                    dragHoldTimer = null;
                    draggedItem = item;
                    window._searchEngineDragging = true;
                    document.body.style.cursor = 'grabbing';
                    document.body.style.userSelect = 'none';
                    enginesContainer.classList.add('engines-dragging');
                    dragOriginalIndex = getEngineItems().indexOf(item);
                    document.body.appendChild(draggedItem);
                    draggedItem.classList.add('dragging');
                    draggedItem.style.width = rect.width + 'px';
                    draggedItem.style.left = (e.clientX - dragOffsetX) + 'px';
                    draggedItem.style.top = (e.clientY - dragOffsetY) + 'px';
                    if (isGridMode()) {
                        const grid = getGridDrop(e.clientX, e.clientY);
                        updateDropMarker(grid.index);
                        if (dropMarker && grid.marker) {
                            dropMarker.style.left = grid.marker.x + 'px';
                            dropMarker.style.top = grid.marker.y + 'px';
                            dropMarker.style.height = grid.marker.h + 'px';
                        }
                    } else {
                        updateDropMarker(getDropIndexFromY(e.clientY));
                    }
                    document.addEventListener('mousemove', onDragMove);
                    document.addEventListener('mouseup', onDragEnd);
                    document.addEventListener('mouseleave', onDragEnd);
                }, 200);
            });

            document.addEventListener('mouseup', () => {
                if (dragHoldTimer) {
                    clearTimeout(dragHoldTimer);
                    dragHoldTimer = null;
                }
            });

            enginesContainer.addEventListener('mouseleave', () => {
                if (dragHoldTimer) {
                    clearTimeout(dragHoldTimer);
                    dragHoldTimer = null;
                }
            });
        }

        function saveEngineOrder() {
            const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
            if (!enginesContainer) return;
            const items = Array.from(enginesContainer.querySelectorAll('.dropdown-item')).filter(
                el => el.querySelector('.dropdown-engine-label')
            );
            const order = items.map(item => getEngineLabel(item));
            if (order.length) localStorage.setItem(SEARCH_ENGINE_ORDER_KEY, JSON.stringify(order));
            updateReorderResetButtonState();
            updateKeyboardNumbers();
            const underlineEnabled = isUnderlineSearchEnginesEnabled();
            if (underlineEnabled) applyEngineInitialUnderlines();
            else clearEngineInitialUnderlines();
        }
        
        // One-off buttons visibility toggle
        const quickButtonsToggle = document.getElementById('quick-buttons-toggle');
        if (quickButtonsToggle) {
            const applyQuickButtonsState = (visible) => {
                const icon = quickButtonsToggle.querySelector('.quick-buttons-icon');
                const label = quickButtonsToggle.querySelector('.quick-buttons-label');
                if (visible) {
                    quickButtonsToggle.dataset.visibility = 'shown';
                    icon.src = 'icons/eye-off.svg';
                    label.textContent = 'Hide one-off buttons';
                } else {
                    quickButtonsToggle.dataset.visibility = 'hidden';
                    icon.src = 'icons/eye.svg';
                    label.textContent = 'Show one-off buttons';
                }
            };
            const savedQuickButtons = localStorage.getItem(QUICK_BUTTONS_VISIBLE_KEY);
            if (savedQuickButtons === 'true') {
                applyQuickButtonsState(true);
            } else {
                applyQuickButtonsState(false);
            }
            quickButtonsToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isShown = quickButtonsToggle.dataset.visibility === 'shown';
                const willBeShown = !isShown;
                applyQuickButtonsState(willBeShown);
                localStorage.setItem(QUICK_BUTTONS_VISIBLE_KEY, String(willBeShown));
            });
        }

        // Restore saved default search engine and order on load
        const enginesContainerForRestore = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        if (enginesContainerForRestore) {
            const engineItems = Array.from(enginesContainerForRestore.querySelectorAll('.dropdown-item')).filter(
                el => el.querySelector('.dropdown-engine-label')
            );
            const savedOrder = localStorage.getItem(SEARCH_ENGINE_ORDER_KEY);
            if (savedOrder) {
                try {
                    const order = JSON.parse(savedOrder);
                    const byLabel = new Map(engineItems.map(item => [getEngineLabel(item), item]));
                    const ordered = order.map(label => byLabel.get(label)).filter(Boolean);
                    const rest = engineItems.filter(item => !order.includes(getEngineLabel(item)));
                    ordered.concat(rest).forEach(item => enginesContainerForRestore.appendChild(item));
                } catch (_) {}
            }
            const storageKey = getDefaultSearchEngineStorageKeyForPage();
            const lsEngine = getDefaultSearchEngineLocalStorage();
            /* Embedded iframes that cannot read `top.localStorage` fall back to iframe `localStorage`, which can
             * be stale vs the parent. Applying that here used to call `setDefaultSearchEngineStorageItem`,
             * which postMessages the parent and overwrote a fresh “Google” right after Reset prototype. */
            const iframeUsesIsolatedLocalStorage =
                window !== window.top && lsEngine === localStorage;
            let savedEngine = lsEngine.getItem(storageKey);
            if (
                (storageKey === DEFAULT_SEARCH_ENGINE_KEY_ADDRESSBAR ||
                    storageKey === DEFAULT_SEARCH_ENGINE_KEY_STANDALONE) &&
                !savedEngine
            ) {
                savedEngine = lsEngine.getItem(DEFAULT_SEARCH_ENGINE_KEY_MAIN);
            }
            if (savedEngine && !iframeUsesIsolatedLocalStorage) {
                const reorderedItems = Array.from(enginesContainerForRestore.querySelectorAll('.dropdown-item')).filter(
                    el => el.querySelector('.dropdown-engine-label')
                );
                const match = reorderedItems.find(item => getEngineLabel(item) === savedEngine);
                if (match) {
                    applySelectedSearchSource(match);
                    setPinnedEngine(match);
                    if (window === window.top) {
                        try {
                            setDefaultSearchEngineStorageItem(storageKey, savedEngine);
                        } catch (_) {}
                    }
                }
                syncSearchSettingsDefaultEngineSelects();
            } else if (savedEngine && iframeUsesIsolatedLocalStorage) {
                /* Do not apply stale labels or clobber parent; parent’s seed message runs next tick. */
                syncSearchSettingsDefaultEngineSelects();
            } else {
                const pinnedItem = enginesContainerForRestore.querySelector('.dropdown-item-pinned');
                if (pinnedItem) {
                    applySelectedSearchSource(pinnedItem);
                    const pl = getEngineLabel(pinnedItem);
                    if (pl && window === window.top) {
                        try {
                            setDefaultSearchEngineStorageItem(storageKey, pl);
                        } catch (_) {}
                    }
                }
                syncSearchSettingsDefaultEngineSelects();
            }

            if (window !== window.top) {
                notifyParentDefaultSearchEngineChanged();
            }

            ensureRowActions();
            const underlineEnabled = isUnderlineSearchEnginesEnabled();
            if (underlineEnabled) applyEngineInitialUnderlines();
            else clearEngineInitialUnderlines();

            const getEngineItemsForSort = () => Array.from(enginesContainerForRestore.children).filter(
                c => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
            );

            const sortSection = document.createElement('div');
            sortSection.className = 'engines-sort-section';
            sortSection.hidden = true;
            enginesContainerForRestore.appendChild(sortSection);

            const resetOrderBtn = document.getElementById('search-engines-reset-order-button');
            if (resetOrderBtn) {
                resetOrderBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (resetOrderBtn.hasAttribute('hidden')) return;
                    const items = getEngineItemsForSort();
                    const sorted = [...items].sort((a, b) => getEngineLabel(a).localeCompare(getEngineLabel(b)));
                    sorted.forEach((item) => enginesContainerForRestore.insertBefore(item, sortSection));
                    const order = sorted.map((item) => getEngineLabel(item));
                    if (order.length) localStorage.setItem(SEARCH_ENGINE_ORDER_KEY, JSON.stringify(order));
                    updateReorderResetButtonState();
                    updateKeyboardNumbers();
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            const smooth = !document.body.classList.contains('reduced-motion');
                            enginesContainerForRestore.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
                        });
                    });
                });
            }

            updateReorderResetButtonState();
            applySearchEnginesCountMode(localStorage.getItem(TWELVE_SEARCH_ENGINES_ENABLED_KEY) !== 'false');
        }
    }
    
    // Handle reduced motion checkbox (default: off)
    if (reducedMotionCheckbox) {
        const savedReducedMotion = localStorage.getItem('reduced_motion_enabled');
        if (savedReducedMotion === 'true') {
            reducedMotionCheckbox.checked = true;
            document.body.classList.add('reduced-motion');
        } else {
            reducedMotionCheckbox.checked = false;
        }
        reducedMotionCheckbox.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            if (enabled) {
                document.body.classList.add('reduced-motion');
                localStorage.setItem('reduced_motion_enabled', 'true');
            } else {
                document.body.classList.remove('reduced-motion');
                localStorage.setItem('reduced_motion_enabled', 'false');
            }
            [document.querySelector('.addressbar-iframe'), document.querySelector('.standalone-search-box-iframe')]
                .filter(Boolean)
                .forEach(f => {
                    try {
                        f.contentWindow?.postMessage({ type: 'reduced-motion', enabled }, '*');
                    } catch (_) {}
                });
        });
    }

    // Search border colour swatches (solid ring on focus)
    const searchBorderSwatches = document.querySelectorAll('.search-border-swatch');
    if (searchBorderSwatches.length) {
        const persistAndApply = (hex) => {
            const c = canonicalSearchBorderColor(hex);
            localStorage.setItem(SEARCH_BORDER_COLOR_KEY, c);
            applySearchBorderColorVariable(c);
            searchBorderSwatches.forEach(btn => {
                const bn = normalizeSearchBorderColorInput(btn.dataset.borderColor);
                btn.setAttribute('aria-pressed', bn === c ? 'true' : 'false');
            });
            [document.querySelector('.addressbar-iframe'), document.querySelector('.standalone-search-box-iframe')]
                .filter(Boolean)
                .forEach(f => {
                    try {
                        f.contentWindow?.postMessage({ type: 'search-border-color', color: c }, '*');
                    } catch (_) {}
                });
            // Main page search bar only: focus search so the ring (:has(.search-input:focus)) stays visible.
            // When suggestions are already open, use the same path as switcher restore so we do not remove
            // suggestions-revealed and replay the open transition.
            if (
                window === window.top &&
                searchInput &&
                searchContainer &&
                suggestionsList &&
                !document.body.classList.contains('addressbar')
            ) {
                if (suggestionsList.classList.contains('suggestions-revealed')) {
                    restoringFocusFromSwitcher = true;
                }
                requestAnimationFrame(() => {
                    searchInput.focus({ preventScroll: true });
                });
            }
        };
        const initial = getStoredSearchBorderColor();
        localStorage.setItem(SEARCH_BORDER_COLOR_KEY, initial);
        applySearchBorderColorVariable(initial);
        searchBorderSwatches.forEach(btn => {
            const bn = normalizeSearchBorderColorInput(btn.dataset.borderColor);
            btn.setAttribute('aria-pressed', bn === initial ? 'true' : 'false');
            btn.addEventListener('click', () => {
                persistAndApply(btn.dataset.borderColor);
            });
        });
    } else if (window === window.top) {
        const initial = getStoredSearchBorderColor();
        localStorage.setItem(SEARCH_BORDER_COLOR_KEY, initial);
        applySearchBorderColorVariable(initial);
    }

    // Handle pin default search engine checkbox (default: off)
    const pinDefaultCheckbox = document.querySelector('.pin-default-checkbox');
    if (pinDefaultCheckbox) {
        const savedPinDefault = localStorage.getItem(PIN_DEFAULT_SEARCH_ENGINE_ENABLED_KEY);
        if (savedPinDefault === 'true') {
            pinDefaultCheckbox.checked = true;
            document.body.classList.add('pin-default-enabled');
        } else {
            pinDefaultCheckbox.checked = false;
        }
        updateDefaultBadge();
        pinDefaultCheckbox.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            if (enabled) {
                document.body.classList.add('pin-default-enabled');
                localStorage.setItem(PIN_DEFAULT_SEARCH_ENGINE_ENABLED_KEY, 'true');
            } else {
                document.body.classList.remove('pin-default-enabled');
                localStorage.setItem(PIN_DEFAULT_SEARCH_ENGINE_ENABLED_KEY, 'false');
            }
            updateDefaultBadge();
            [document.querySelector('.addressbar-iframe'), document.querySelector('.standalone-search-box-iframe')]
                .filter(Boolean)
                .forEach(f => {
                    try {
                        f.contentWindow?.postMessage({ type: 'pin-default', enabled }, '*');
                    } catch (_) {}
                });
        });
    }

    // Number of search engines: 6 vs 12 (default: 12)
    const searchEnginesCountRadios = document.querySelectorAll('.search-engines-count-radio');
    if (searchEnginesCountRadios.length) {
        const twelveEnabled = localStorage.getItem(TWELVE_SEARCH_ENGINES_ENABLED_KEY) !== 'false';
        searchEnginesCountRadios.forEach((radio) => {
            radio.checked = (radio.value === '12') === twelveEnabled;
        });
        applySearchEnginesCountMode(twelveEnabled);
        searchEnginesCountRadios.forEach((radio) => {
            radio.addEventListener('change', () => {
                if (!radio.checked) return;
                const on = radio.value === '12';
                localStorage.setItem(TWELVE_SEARCH_ENGINES_ENABLED_KEY, on ? 'true' : 'false');
                applySearchEnginesCountMode(on);
                [document.querySelector('.addressbar-iframe'), document.querySelector('.standalone-search-box-iframe')]
                    .filter(Boolean)
                    .forEach(f => {
                        try {
                            f.contentWindow?.postMessage({ type: 'twelve-search-engines', enabled: on }, '*');
                        } catch (_) {}
                    });
            });
        });
    }

    // List/grid segmented control in the switcher controls panel (per-search-bar preference).
    const searchEnginesDisplayToggle = document.getElementById('search-engines-display-toggle');
    if (searchEnginesDisplayToggle) {
        const flipSearchEnginesDisplayMode = () => {
            const current = getSearchEnginesDisplayMode();
            const next = current === 'grid' ? 'list' : 'grid';
            localStorage.setItem(getSearchEnginesDisplayKey(), next);
            applySearchEnginesDisplayMode(next);
        };
        searchEnginesDisplayToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            flipSearchEnginesDisplayMode();
        });
        searchEnginesDisplayToggle.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            if (!searchEnginesDisplayToggle.contains(e.target)) return;
            e.preventDefault();
            e.stopPropagation();
            flipSearchEnginesDisplayMode();
        });
    }

    const searchEnginesControlsToggle = document.getElementById('search-engines-controls-toggle');
    const searchEnginesControlsPanel = document.getElementById('search-engines-controls-panel');
    const searchSwitcherInfoToggle = document.getElementById('search-switcher-info-toggle');
    const searchSwitcherInfoPanel = document.getElementById('search-switcher-info-panel');
    const subpanelsClip =
        searchEnginesControlsPanel?.closest('.dropdown-switcher-subpanels-clip') ??
        searchSwitcherInfoPanel?.closest('.dropdown-switcher-subpanels-clip');

    const syncSubpanelsClipOpen = () => {
        if (!subpanelsClip) return;
        const controlsOpen = searchEnginesControlsPanel && !searchEnginesControlsPanel.hasAttribute('hidden');
        const infoOpen = searchSwitcherInfoPanel && !searchSwitcherInfoPanel.hasAttribute('hidden');
        subpanelsClip.classList.toggle(
            'dropdown-switcher-subpanels-clip--open',
            !!(controlsOpen || infoOpen)
        );
    };

    const syncSearchEnginesControlsExpanded = () => {
        if (!searchEnginesControlsPanel || !searchEnginesControlsToggle) return;
        const open = !searchEnginesControlsPanel.hasAttribute('hidden');
        searchEnginesControlsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        syncEngineDragHandlesForControlsPanel();
    };

    const closeSearchEnginesControlsPanelInstant = () => {
        if (!searchEnginesControlsPanel || !searchEnginesControlsToggle) return;
        if (searchEnginesControlsPanel.hasAttribute('hidden')) return;
        searchEnginesControlsPanel.setAttribute('hidden', '');
        searchEnginesControlsToggle.setAttribute('aria-expanded', 'false');
        syncSubpanelsClipOpen();
        searchSwitcherButton?.classList.remove('search-engines-controls-panel-revealed');
        syncSearchEnginesControlsExpanded();
    };

    const closeSearchSwitcherInfoPanelInstant = () => {
        if (!searchSwitcherInfoPanel || !searchSwitcherInfoToggle) return;
        if (searchSwitcherInfoPanel.hasAttribute('hidden')) return;
        searchSwitcherInfoPanel.setAttribute('hidden', '');
        searchSwitcherInfoToggle.setAttribute('aria-expanded', 'false');
        syncSubpanelsClipOpen();
    };

    const PANEL_SLIDE_MS = 320;

    /** When swapping (i) ↔ controls, skip enter animation so one panel replaces the other cleanly. */
    const openSearchEnginesControlsPanelInstantSwap = () => {
        if (!subpanelsClip || !searchEnginesControlsPanel) return;
        clearFromFirefoxFooterFlipStyles();
        searchSwitcherInfoPanel?.setAttribute('hidden', '');
        searchSwitcherInfoToggle?.setAttribute('aria-expanded', 'false');
        searchEnginesControlsPanel.removeAttribute('hidden');
        searchEnginesControlsToggle?.setAttribute('aria-expanded', 'true');
        subpanelsClip.classList.add('dropdown-switcher-subpanels-clip--open');
        syncSearchEnginesControlsExpanded();
        searchSwitcherButton?.classList.add('search-engines-controls-panel-revealed');
        syncSearchSwitcherDropdownWidth();
    };

    const openSearchSwitcherInfoPanelInstantSwap = () => {
        if (!subpanelsClip || !searchSwitcherInfoPanel) return;
        clearFromFirefoxFooterFlipStyles();
        searchEnginesControlsPanel?.setAttribute('hidden', '');
        searchEnginesControlsToggle?.setAttribute('aria-expanded', 'false');
        searchSwitcherInfoPanel.removeAttribute('hidden');
        searchSwitcherInfoToggle.setAttribute('aria-expanded', 'true');
        subpanelsClip.classList.add('dropdown-switcher-subpanels-clip--open');
        syncSearchEnginesControlsExpanded();
        searchSwitcherButton?.classList.remove('search-engines-controls-panel-revealed');
        syncSearchSwitcherDropdownWidth();
    };

    /** Smooth layout jump when “From Firefox” switches sticky ↔ static (runs in parallel with the controls panel slide). */
    const runFromFirefoxFooterFlipTransition = (footer, firstRect) => {
        if (!footer || !firstRect) return;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const lastRect = footer.getBoundingClientRect();
                const dx = firstRect.left - lastRect.left;
                const dy = firstRect.top - lastRect.top;
                if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
                footer.style.transition = 'none';
                footer.style.transform = `translate(${dx}px, ${dy}px)`;
                void footer.offsetHeight;
                requestAnimationFrame(() => {
                    footer.style.transition =
                        'transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)';
                    footer.style.transform = 'translate(0, 0)';
                    const cleanup = () => {
                        footer.removeEventListener('transitionend', onTfEnd);
                        footer.style.transition = '';
                        footer.style.transform = '';
                    };
                    const onTfEnd = (e) => {
                        if (e && e.propertyName !== 'transform') return;
                        cleanup();
                    };
                    footer.addEventListener('transitionend', onTfEnd);
                    setTimeout(cleanup, 420);
                });
            });
        });
    };

    if (searchEnginesControlsToggle && searchEnginesControlsPanel) {
        const toggleSearchEnginesControlsPanel = () => {
            if (!subpanelsClip) {
                searchEnginesControlsPanel.toggleAttribute('hidden');
                syncSearchEnginesControlsExpanded();
                const open = !searchEnginesControlsPanel.hasAttribute('hidden');
                searchSwitcherButton?.classList.toggle('search-engines-controls-panel-revealed', open);
                syncSearchSwitcherDropdownWidth();
                return;
            }
            const opening = searchEnginesControlsPanel.hasAttribute('hidden');
            if (opening) {
                const wasInfoOpen =
                    searchSwitcherInfoPanel && !searchSwitcherInfoPanel.hasAttribute('hidden');
                clearFromFirefoxFooterFlipStyles();
                if (wasInfoOpen) {
                    openSearchEnginesControlsPanelInstantSwap();
                    return;
                }
                closeSearchSwitcherInfoPanelInstant();
                searchEnginesControlsPanel.removeAttribute('hidden');
                requestAnimationFrame(() => {
                    subpanelsClip.classList.add('dropdown-switcher-subpanels-clip--open');
                    syncSearchEnginesControlsExpanded();
                    const rm = document.body.classList.contains('reduced-motion');
                    if (rm) {
                        searchSwitcherButton?.classList.add('search-engines-controls-panel-revealed');
                        syncSearchSwitcherDropdownWidth();
                    } else {
                        requestAnimationFrame(() => {
                            searchSwitcherButton?.classList.add('search-engines-controls-panel-revealed');
                            syncSearchSwitcherDropdownWidth();
                        });
                    }
                });
                return;
            }
            const footer = searchSwitcherButton?.querySelector('.dropdown-from-firefox-footer');
            const wantFooterFlip =
                footer &&
                !document.body.classList.contains('reduced-motion') &&
                searchSwitcherButton.classList.contains('search-engines-controls-panel-revealed');
            let footerFlipFirstRect = null;
            if (wantFooterFlip) {
                footerFlipFirstRect = footer.getBoundingClientRect();
            }
            subpanelsClip.classList.remove('dropdown-switcher-subpanels-clip--open');
            searchSwitcherButton?.classList.remove('search-engines-controls-panel-revealed');
            searchEnginesControlsToggle.setAttribute('aria-expanded', 'false');
            if (wantFooterFlip && footerFlipFirstRect) {
                runFromFirefoxFooterFlipTransition(footer, footerFlipFirstRect);
            }
            let settled = false;
            const settle = () => {
                if (settled) return;
                settled = true;
                subpanelsClip.removeEventListener('transitionend', onTrEnd);
                clearTimeout(fallbackTimer);
                searchEnginesControlsPanel.setAttribute('hidden', '');
                syncSearchEnginesControlsExpanded();
                syncSearchSwitcherDropdownWidth();
            };
            const onTrEnd = (ev) => {
                if (ev.target !== subpanelsClip || ev.propertyName !== 'grid-template-rows') return;
                settle();
            };
            subpanelsClip.addEventListener('transitionend', onTrEnd);
            const fallbackTimer = setTimeout(
                settle,
                document.body.classList.contains('reduced-motion') ? 0 : PANEL_SLIDE_MS + 100
            );
        };
        searchEnginesControlsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSearchEnginesControlsPanel();
        });
        searchEnginesControlsToggle.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            toggleSearchEnginesControlsPanel();
        });
        syncSearchEnginesControlsExpanded();
    }

    if (searchSwitcherInfoToggle && searchSwitcherInfoPanel) {
        const toggleSearchSwitcherInfoPanel = () => {
            if (!subpanelsClip) {
                searchSwitcherInfoPanel.toggleAttribute('hidden');
                const open = !searchSwitcherInfoPanel.hasAttribute('hidden');
                searchSwitcherInfoToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
                return;
            }
            const opening = searchSwitcherInfoPanel.hasAttribute('hidden');
            if (opening) {
                clearFromFirefoxFooterFlipStyles();
                const wasControlsOpen =
                    searchEnginesControlsPanel && !searchEnginesControlsPanel.hasAttribute('hidden');
                if (wasControlsOpen) {
                    openSearchSwitcherInfoPanelInstantSwap();
                    return;
                }
                closeSearchEnginesControlsPanelInstant();
                searchSwitcherInfoPanel.removeAttribute('hidden');
                requestAnimationFrame(() => {
                    subpanelsClip.classList.add('dropdown-switcher-subpanels-clip--open');
                    searchSwitcherInfoToggle.setAttribute('aria-expanded', 'true');
                    syncSearchSwitcherDropdownWidth();
                    requestAnimationFrame(() => syncSearchSwitcherDropdownWidth());
                });
                return;
            }
            clearFromFirefoxFooterFlipStyles();
            const footer = searchSwitcherButton?.querySelector('.dropdown-from-firefox-footer');
            const wantFooterFlip =
                footer &&
                !document.body.classList.contains('reduced-motion') &&
                searchSwitcherInfoPanel &&
                !searchSwitcherInfoPanel.hasAttribute('hidden');
            let footerFlipFirstRect = null;
            if (wantFooterFlip) {
                footerFlipFirstRect = footer.getBoundingClientRect();
            }
            subpanelsClip.classList.remove('dropdown-switcher-subpanels-clip--open');
            searchSwitcherButton?.classList.add('search-switcher-info-panel-footer-flip');
            searchSwitcherInfoToggle.setAttribute('aria-expanded', 'false');
            if (wantFooterFlip && footerFlipFirstRect) {
                runFromFirefoxFooterFlipTransition(footer, footerFlipFirstRect);
            }
            let settled = false;
            const settle = () => {
                if (settled) return;
                settled = true;
                subpanelsClip.removeEventListener('transitionend', onTrEnd);
                clearTimeout(fallbackTimer);
                searchSwitcherInfoPanel.setAttribute('hidden', '');
                searchSwitcherButton?.classList.remove('search-switcher-info-panel-footer-flip');
                syncSearchSwitcherDropdownWidth();
            };
            const onTrEnd = (ev) => {
                if (ev.target !== subpanelsClip || ev.propertyName !== 'grid-template-rows') return;
                settle();
            };
            subpanelsClip.addEventListener('transitionend', onTrEnd);
            const fallbackTimer = setTimeout(
                settle,
                document.body.classList.contains('reduced-motion') ? 0 : PANEL_SLIDE_MS + 100
            );
        };
        searchSwitcherInfoToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSearchSwitcherInfoPanel();
        });
        searchSwitcherInfoToggle.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            toggleSearchSwitcherInfoPanel();
        });
    }

    // Handle standalone search box checkbox (default: off)
    const standaloneSearchBoxCheckbox = document.querySelector('.standalone-search-box-checkbox');
    if (standaloneSearchBoxCheckbox) {
        const savedStandaloneVisible = localStorage.getItem(STANDALONE_SEARCH_BOX_VISIBLE_KEY);
        if (savedStandaloneVisible === 'true') {
            standaloneSearchBoxCheckbox.checked = true;
            document.body.classList.add('standalone-search-box-visible');
        } else {
            standaloneSearchBoxCheckbox.checked = false;
        }
        standaloneSearchBoxCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('standalone-search-box-visible');
                localStorage.setItem(STANDALONE_SEARCH_BOX_VISIBLE_KEY, 'true');
            } else {
                document.body.classList.remove('standalone-search-box-visible');
                localStorage.setItem(STANDALONE_SEARCH_BOX_VISIBLE_KEY, 'false');
            }
        });
    }

    const searchSettingsModal = document.getElementById('search-settings-modal');
    let searchSettingsModalPreviousFocus = null;
    const onSearchSettingsModalKeydown = (e) => {
        if (e.key === 'Escape' && searchSettingsModal && !searchSettingsModal.hidden) {
            e.preventDefault();
            e.stopPropagation();
            closeSearchSettingsModal();
        }
    };
    const closeSearchSettingsModal = () => {
        if (!searchSettingsModal || searchSettingsModal.hidden) return;
        searchSettingsModal.hidden = true;
        searchSettingsModal.setAttribute('aria-hidden', 'true');
        document.removeEventListener('keydown', onSearchSettingsModalKeydown, true);
        if (searchSettingsModalPreviousFocus && typeof searchSettingsModalPreviousFocus.focus === 'function') {
            try {
                searchSettingsModalPreviousFocus.focus();
            } catch (_) {}
        }
        searchSettingsModalPreviousFocus = null;
    };
    const openSearchSettingsModal = () => {
        if (!searchSettingsModal) return;
        if (window === window.top) {
            try {
                hideTooltip();
            } catch (_) {}
            if (document.activeElement?.closest?.('.bottom-left-panel')) {
                try {
                    document.activeElement.blur();
                } catch (_) {}
            }
            closeSuggestionsPanel();
            if (searchSwitcherButton?.classList.contains('open')) {
                beginSwitcherClosingShapeHoldUntilDropdownAnimation(searchSwitcherButton);
                searchSwitcherButton.classList.remove('switcher-opened-by-keyboard', 'switcher-suppress-hover');
                searchSwitcherButton.querySelector('.search-switcher-dropdown')?.classList.remove('dropdown-revealed');
                switcherHighlightedIndex = -1;
                searchSwitcherButton.querySelectorAll('.dropdown-item').forEach((item) => item.classList.remove('highlighted'));
                forceCloseSearchSwitcherSubPanels();
                searchSwitcherButton.classList.remove('open');
            }
            restoringFocusFromSwitcher = false;
            closingSwitcherWithoutSuggestions = false;
            try {
                searchInput?.blur?.();
            } catch (_) {}
            [document.querySelector('.addressbar-iframe'), document.querySelector('.standalone-search-box-iframe')]
                .filter(Boolean)
                .forEach((f) => {
                    try {
                        f.contentWindow?.postMessage({ type: 'close-switcher' }, '*');
                    } catch (_) {}
                });
        }
        syncSearchSettingsDefaultEngineSelects();
        logSearchSettingsOverlayOpened();
        searchSettingsModalPreviousFocus = document.activeElement;
        searchSettingsModal.hidden = false;
        searchSettingsModal.setAttribute('aria-hidden', 'false');
        document.addEventListener('keydown', onSearchSettingsModalKeydown, true);
        const closeBtn = searchSettingsModal.querySelector('.search-settings-modal-close');
        try {
            closeBtn?.focus();
        } catch (_) {}
    };
    if (searchSettingsModal) {
        searchSettingsModal.querySelectorAll('[data-close-search-settings]').forEach((el) => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                closeSearchSettingsModal();
            });
        });
        const selAddr = document.getElementById('search-settings-default-engine-address-bar');
        const selMain = document.getElementById('search-settings-default-engine-new-tab');
        const selStandalone = document.getElementById('search-settings-default-engine-standalone');
        const addressbarIframeForSettings = document.querySelector('.addressbar-iframe');
        const standaloneIframeForSettings = document.querySelector('.standalone-search-box-iframe');
        const postRefreshSearchSwitcherToIframe = (contentWindow, oldEffectiveDefault) => {
            try {
                contentWindow?.postMessage(
                    {
                        type: 'refresh-search-engine-switcher-from-storage',
                        ...(oldEffectiveDefault !== undefined && oldEffectiveDefault !== null
                            ? { oldEffectiveDefault: String(oldEffectiveDefault) }
                            : {})
                    },
                    '*'
                );
            } catch (_) {}
        };
        const mirrorKeyToIframe = (contentWindow, key, value) => {
            try {
                contentWindow?.postMessage({ type: 'mirror-default-search-engine', key, value: String(value) }, '*');
            } catch (_) {}
        };
        if (selAddr) {
            selAddr.addEventListener('change', () => {
                if (applyingSearchSettingsEngineSelectsSync) return;
                const effBefore = getEffectiveSearchDefaultsFromStorage();
                const oldAddrEff = effBefore.addressBar;
                const v = selAddr.value;
                setDefaultSearchEngineStorageItem(DEFAULT_SEARCH_ENGINE_KEY_ADDRESSBAR, v);
                syncSearchSettingsDefaultEngineSelects();
                logSearchSettingsEngineSelectChanged('Address bar', v);
                mirrorKeyToIframe(addressbarIframeForSettings?.contentWindow, DEFAULT_SEARCH_ENGINE_KEY_ADDRESSBAR, v);
                postRefreshSearchSwitcherToIframe(addressbarIframeForSettings?.contentWindow, oldAddrEff);
            });
        }
        if (selMain) {
            selMain.addEventListener('change', () => {
                if (applyingSearchSettingsEngineSelectsSync) return;
                const effBefore = getEffectiveSearchDefaultsFromStorage();
                const oldMain = effBefore.newTab;
                const oldAddrEff = effBefore.addressBar;
                const oldStandEff = effBefore.standalone;
                const v = selMain.value;
                setDefaultSearchEngineStorageItem(DEFAULT_SEARCH_ENGINE_KEY_MAIN, v);
                syncSearchSettingsDefaultEngineSelects();
                logSearchSettingsEngineSelectChanged('New tab / Homepage', v);
                applySearchSwitcherAfterSearchSettingsChange(oldMain);
                mirrorKeyToIframe(addressbarIframeForSettings?.contentWindow, DEFAULT_SEARCH_ENGINE_KEY_MAIN, v);
                mirrorKeyToIframe(standaloneIframeForSettings?.contentWindow, DEFAULT_SEARCH_ENGINE_KEY_MAIN, v);
                postRefreshSearchSwitcherToIframe(addressbarIframeForSettings?.contentWindow, oldAddrEff);
                postRefreshSearchSwitcherToIframe(standaloneIframeForSettings?.contentWindow, oldStandEff);
            });
        }
        if (selStandalone) {
            selStandalone.addEventListener('change', () => {
                if (applyingSearchSettingsEngineSelectsSync) return;
                const effBefore = getEffectiveSearchDefaultsFromStorage();
                const oldStandEff = effBefore.standalone;
                const v = selStandalone.value;
                setDefaultSearchEngineStorageItem(DEFAULT_SEARCH_ENGINE_KEY_STANDALONE, v);
                syncSearchSettingsDefaultEngineSelects();
                logSearchSettingsEngineSelectChanged('Standalone search box', v);
                mirrorKeyToIframe(standaloneIframeForSettings?.contentWindow, DEFAULT_SEARCH_ENGINE_KEY_STANDALONE, v);
                postRefreshSearchSwitcherToIframe(standaloneIframeForSettings?.contentWindow, oldStandEff);
            });
        }
    }
    const moreSearchSettingsButton = document.getElementById('more-search-settings-button');
    if (moreSearchSettingsButton) {
        moreSearchSettingsButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window !== window.top) {
                try {
                    window.parent.postMessage({ type: 'open-search-settings' }, '*');
                } catch (_) {}
                return;
            }
            if (searchSettingsModal) {
                openSearchSettingsModal();
            }
        });
    }
    window.addEventListener('storage', (e) => {
        if (e.storageArea !== localStorage) return;
        if (
            e.key !== DEFAULT_SEARCH_ENGINE_KEY_MAIN &&
            e.key !== DEFAULT_SEARCH_ENGINE_KEY_ADDRESSBAR &&
            e.key !== DEFAULT_SEARCH_ENGINE_KEY_STANDALONE
        ) {
            return;
        }
        syncSearchSettingsDefaultEngineSelects();
    });

    if (window === window.top) {
        window.addEventListener('message', (e) => {
            if (e.data?.type === 'set-default-search-engine') {
                if (e.origin !== window.location.origin && e.origin !== 'null') return;
                const { key, value } = e.data;
                if (typeof key !== 'string' || typeof value !== 'string') return;
                if (
                    key !== DEFAULT_SEARCH_ENGINE_KEY_MAIN &&
                    key !== DEFAULT_SEARCH_ENGINE_KEY_ADDRESSBAR &&
                    key !== DEFAULT_SEARCH_ENGINE_KEY_STANDALONE
                ) {
                    return;
                }
                try {
                    localStorage.setItem(key, value);
                    syncSearchSettingsDefaultEngineSelects();
                } catch (_) {}
                try {
                    e.source?.postMessage?.({ type: 'mirror-default-search-engine', key, value }, '*');
                } catch (_) {}
                return;
            }
            if (e.data?.type === 'default-search-engine-changed') {
                // Same-origin iframes; do not rely on e.source === iframe.contentWindow (timing can fail).
                if (e.origin === window.location.origin || e.origin === 'null') {
                    syncSearchSettingsDefaultEngineSelects();
                }
                return;
            }
            if (e.data?.type !== 'open-search-settings') return;
            const addressbarIframe = document.querySelector('.addressbar-iframe');
            const standaloneIframe = document.querySelector('.standalone-search-box-iframe');
            const fromTrustedChild =
                (addressbarIframe && e.source === addressbarIframe.contentWindow) ||
                (standaloneIframe && e.source === standaloneIframe.contentWindow);
            if (!fromTrustedChild) return;
            if (searchSettingsModal) {
                openSearchSettingsModal();
            }
        });
    }

    syncSearchSettingsDefaultEngineSelects();

    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('settings') === '1' && searchSettingsModal) {
            openSearchSettingsModal();
        }
    } catch (_) {}

    // Switcher outside search box (lilac "This menu" control; was "Pin this menu" in the dropdown)
    const pinMenuToggle = document.getElementById('pin-menu-toggle');
    let cancelPinMenuFlip = null;
    let pinMenuFlipSeq = 0;
    const pinMenuRectStr = (r) =>
        `L${Math.round(r.left)} T${Math.round(r.top)} W${Math.round(r.width)} H${Math.round(r.height)}`;
    const DEBUG_PIN_MENU =
        typeof localStorage !== 'undefined' && localStorage.getItem('debug_pin_menu') === 'true';
    const logPinMenu = (msg, detail = {}) => {
        if (!DEBUG_PIN_MENU) return;
        const t = typeof performance !== 'undefined' ? performance.now().toFixed(1) : String(Date.now());
        console.log(`[pin-menu +${t}ms]`, msg, detail);
    };
    const getSearchEngineListMode = () => {
        try {
            const raw = localStorage.getItem(SEARCH_ENGINE_LIST_MODE_KEY);
            if (raw === 'closed' || raw === 'pinned-left' || raw === 'pinned-right') return raw;
            // First run with no saved mode: default to closed (do not migrate legacy switcher to pinned-left).
            localStorage.setItem(SEARCH_ENGINE_LIST_MODE_KEY, 'closed');
            return 'closed';
        } catch (_) {
            return 'closed';
        }
    };
    const applyPinnedMenuState = (on, options = {}) => {
        const enabled = !!on;
        const wantFlip = options.animate !== false && !document.body.classList.contains('reduced-motion');
        const btn = searchSwitcherButton;
        let firstBtnRect = null;
        let firstInputRect = null;
        const seq = ++pinMenuFlipSeq;
        const searchFocused = !!searchContainer?.classList.contains('focused');
        logPinMenu('applyPinnedMenuState', {
            seq,
            enabled,
            animate: options.animate !== false,
            wantFlip,
            reducedMotion: document.body.classList.contains('reduced-motion'),
            outsideBefore: document.body.classList.contains('switcher-outside-search-box-enabled'),
            searchFocused,
        });
        if (wantFlip && btn) {
            if (cancelPinMenuFlip) {
                logPinMenu('cancel in-flight FLIP', { seq });
                cancelPinMenuFlip();
                cancelPinMenuFlip = null;
            }
            firstBtnRect = btn.getBoundingClientRect();
            if (searchInput) firstInputRect = searchInput.getBoundingClientRect();
            logPinMenu('pre-toggle switcher rect', { seq, rect: pinMenuRectStr(firstBtnRect), computedTransform: getComputedStyle(btn).transform });
            if (firstInputRect) {
                logPinMenu('pre-toggle search-input rect', { seq, rect: pinMenuRectStr(firstInputRect) });
            }
        }
        document.body.classList.toggle('switcher-outside-search-box-enabled', enabled);
        localStorage.setItem(SWITCHER_OUTSIDE_SEARCH_BOX_ENABLED_KEY, enabled ? 'true' : 'false');
        if (pinMenuToggle) {
            pinMenuToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
            const icon = pinMenuToggle.querySelector('.pin-menu-toggle-icon');
            const label = pinMenuToggle.querySelector('.pin-menu-toggle-label');
            if (icon) icon.src = enabled ? 'icons/pin-filled.svg' : 'icons/pin.svg';
            if (label) label.textContent = enabled ? 'Unpin this menu' : 'Pin this menu';
        }
        const searchEngineListModeSelectSync = document.getElementById('search-engine-list-mode-select');
        if (searchEngineListModeSelectSync) {
            try {
                searchEngineListModeSelectSync.value = getSearchEngineListMode();
            } catch (_) {}
        }
        if (!wantFlip || !btn || !firstBtnRect) {
            if (btn) {
                const reason = !wantFlip
                    ? 'wantFlip=false (animate:false on load/reset, or reduced-motion)'
                    : !firstBtnRect
                      ? 'no firstBtnRect (unexpected)'
                      : 'no switcher button';
                logPinMenu('skip FLIP (no animation path)', {
                    seq,
                    reason,
                    wantFlip,
                    hasBtn: !!btn,
                    firstBtnRectCaptured: !!firstBtnRect,
                    rectAfterToggle: pinMenuRectStr(btn.getBoundingClientRect()),
                    computedTransform: getComputedStyle(btn).transform,
                });
            }
            return;
        }
        requestAnimationFrame(() => {
            const lastBtnRect = btn.getBoundingClientRect();
            const lastInputRect = searchInput ? searchInput.getBoundingClientRect() : null;
            const btnDx = firstBtnRect.left - lastBtnRect.left;
            const btnDy = firstBtnRect.top - lastBtnRect.top;
            const inDx =
                firstInputRect && lastInputRect ? firstInputRect.left - lastInputRect.left : 0;
            const inDy =
                firstInputRect && lastInputRect ? firstInputRect.top - lastInputRect.top : 0;
            const btnDxR = Math.round(btnDx * 10) / 10;
            const btnDyR = Math.round(btnDy * 10) / 10;
            const inDxR = Math.round(inDx * 10) / 10;
            const inDyR = Math.round(inDy * 10) / 10;
            const flipBtn = Math.abs(btnDx) >= 0.5 || Math.abs(btnDy) >= 0.5;
            const flipInput =
                !!(firstInputRect && lastInputRect && (Math.abs(inDx) >= 0.5 || Math.abs(inDy) >= 0.5));
            logPinMenu(
                `rAF1 after class toggle  switcherDelta=dx:${btnDxR} dy:${btnDyR}  inputDelta=dx:${inDxR} dy:${inDyR}`,
                {
                    seq,
                    lastSwitcherRect: pinMenuRectStr(lastBtnRect),
                    lastInputRect: lastInputRect ? pinMenuRectStr(lastInputRect) : null,
                    flipBtn,
                    flipInput,
                }
            );
            if (!flipBtn && !flipInput) {
                logPinMenu('skip FLIP (no element moved)', { seq });
                return;
            }
            if (flipBtn) {
                btn.style.transition = 'none';
                btn.style.transform = `translate(${btnDx}px, ${btnDy}px)`;
            }
            if (flipInput) {
                searchInput.style.transition = 'none';
                searchInput.style.transform = `translate(${inDx}px, ${inDy}px)`;
            }
            void btn.offsetHeight;
            if (searchInput) void searchInput.offsetHeight;
            logPinMenu('FLIP invert applied', {
                seq,
                switcherTransform: flipBtn ? btn.style.transform : '(none)',
                inputTransform: flipInput ? searchInput.style.transform : '(none)',
            });
            requestAnimationFrame(() => {
                const dur = '0.25s';
                if (flipBtn) {
                    btn.style.transition = `transform ${dur} ease-out`;
                    btn.style.transform = '';
                }
                if (flipInput) {
                    searchInput.style.transition = `transform ${dur} ease-out`;
                    searchInput.style.transform = '';
                }
                logPinMenu('FLIP animate to layout transform', {
                    seq,
                    switcherComputed: flipBtn ? getComputedStyle(btn).transform : 'n/a',
                    inputComputed: flipInput ? getComputedStyle(searchInput).transform : 'n/a',
                });
                let cleaned = false;
                let pendingEnds = (flipBtn ? 1 : 0) + (flipInput ? 1 : 0);
                function cleanup(source) {
                    if (cleaned) return;
                    cleaned = true;
                    if (flipBtn) {
                        btn.removeEventListener('transitionend', onBtnTransitionEnd);
                        btn.style.transition = '';
                        btn.style.transform = '';
                    }
                    if (flipInput) {
                        searchInput.removeEventListener('transitionend', onInputTransitionEnd);
                        searchInput.style.transition = '';
                        searchInput.style.transform = '';
                    }
                    cancelPinMenuFlip = null;
                    logPinMenu('FLIP cleanup', {
                        seq,
                        source,
                        endSwitcherRect: pinMenuRectStr(btn.getBoundingClientRect()),
                        endInputRect: searchInput ? pinMenuRectStr(searchInput.getBoundingClientRect()) : null,
                    });
                }
                function onBtnTransitionEnd(e) {
                    logPinMenu('transitionend (switcher)', {
                        seq,
                        propertyName: e.propertyName,
                        elapsedTime: e.elapsedTime,
                    });
                    if (e.propertyName !== 'transform') return;
                    btn.removeEventListener('transitionend', onBtnTransitionEnd);
                    pendingEnds--;
                    if (pendingEnds <= 0) cleanup('transitionend');
                }
                function onInputTransitionEnd(e) {
                    logPinMenu('transitionend (search-input)', {
                        seq,
                        propertyName: e.propertyName,
                        elapsedTime: e.elapsedTime,
                    });
                    if (e.propertyName !== 'transform') return;
                    searchInput.removeEventListener('transitionend', onInputTransitionEnd);
                    pendingEnds--;
                    if (pendingEnds <= 0) cleanup('transitionend');
                }
                if (flipBtn) btn.addEventListener('transitionend', onBtnTransitionEnd);
                if (flipInput) searchInput.addEventListener('transitionend', onInputTransitionEnd);
                cancelPinMenuFlip = () => cleanup('cancel');
                setTimeout(() => cleanup('timeout350ms'), 350);
            });
        });
    };
    const applySearchEngineListMode = (mode, options = {}) => {
        let m = mode;
        if (m !== 'closed' && m !== 'pinned-left' && m !== 'pinned-right') m = 'closed';
        try {
            localStorage.setItem(SEARCH_ENGINE_LIST_MODE_KEY, m);
        } catch (_) {}
        document.body.classList.toggle('search-engine-list-mode-pinned-right', m === 'pinned-right');
        applyPinnedMenuState(m === 'pinned-left', options);
    };
    const searchEngineListModeSelect = document.getElementById('search-engine-list-mode-select');
    if (searchEngineListModeSelect) {
        applySearchEngineListMode(getSearchEngineListMode(), { animate: false });
        searchEngineListModeSelect.addEventListener('change', () => {
            const next = searchEngineListModeSelect.value;
            logPinMenu('search engine list mode select', { next });
            applySearchEngineListMode(next, { animate: true });
            if (searchInput) searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    // Handle background colour swatches
    const backgroundSwatches = document.querySelectorAll('.background-swatch');
    if (backgroundSwatches.length) {
        const updateSwatchPressed = () => {
            const current = document.body.dataset.background || 'gradient';
            backgroundSwatches.forEach(btn => {
                btn.setAttribute('aria-pressed', btn.dataset.background === current ? 'true' : 'false');
            });
        };
        const savedBg = localStorage.getItem(BACKGROUND_SWATCH_KEY);
        if (savedBg === 'gradient') {
            delete document.body.dataset.background;
        } else if (savedBg) {
            document.body.dataset.background = savedBg;
        } else {
            document.body.dataset.background = DEFAULT_BACKGROUND_SWATCH;
            try {
                localStorage.setItem(BACKGROUND_SWATCH_KEY, DEFAULT_BACKGROUND_SWATCH);
            } catch (_) {}
        }
        updateSwatchPressed();
        backgroundSwatches.forEach(btn => {
            btn.addEventListener('click', () => {
                const bg = btn.dataset.background;
                localStorage.setItem(BACKGROUND_SWATCH_KEY, bg);
                if (bg === 'gradient') {
                    delete document.body.dataset.background;
                } else {
                    document.body.dataset.background = bg;
                }
                updateSwatchPressed();
            });
        });
    }

    // Handle underline first letter of search engines checkbox (default: off)
    const underlineSearchEnginesCheckbox = document.querySelector('.underline-search-engines-checkbox');
    if (underlineSearchEnginesCheckbox) {
        const saved = localStorage.getItem(UNDERLINE_SEARCH_ENGINES_ENABLED_KEY);
        const enabled = saved === 'true';
        underlineSearchEnginesEnabled = enabled;
        underlineSearchEnginesCheckbox.checked = enabled;
        if (enabled) applyEngineInitialUnderlines();
        else clearEngineInitialUnderlines();

        underlineSearchEnginesCheckbox.addEventListener('change', (e) => {
            const on = e.target.checked;
            underlineSearchEnginesEnabled = on;
            localStorage.setItem(UNDERLINE_SEARCH_ENGINES_ENABLED_KEY, on ? 'true' : 'false');
            if (on) applyEngineInitialUnderlines();
            else clearEngineInitialUnderlines();
            [document.querySelector('.addressbar-iframe'), document.querySelector('.standalone-search-box-iframe')]
                .filter(Boolean)
                .forEach(f => {
                    try {
                        f.contentWindow?.postMessage({ type: 'underline-search-engines', enabled: on }, '*');
                    } catch (_) {}
                });
        });
    }

    // Handle keyboard switcher numbers checkbox (default: on)
    const keyboardSwitcherNumbersCheckbox = document.querySelector('.keyboard-switcher-numbers-checkbox');
    if (keyboardSwitcherNumbersCheckbox) {
        const enabled = localStorage.getItem(KEYBOARD_SWITCHER_NUMBERS_ENABLED_KEY) !== 'false';
        keyboardSwitcherNumbersCheckbox.checked = enabled;
        document.body.classList.toggle('keyboard-switcher-numbers-enabled', enabled);
        keyboardSwitcherNumbersCheckbox.addEventListener('change', (e) => {
            const on = e.target.checked;
            localStorage.setItem(KEYBOARD_SWITCHER_NUMBERS_ENABLED_KEY, on ? 'true' : 'false');
            document.body.classList.toggle('keyboard-switcher-numbers-enabled', on);
            [document.querySelector('.addressbar-iframe'), document.querySelector('.standalone-search-box-iframe')]
                .filter(Boolean)
                .forEach(f => {
                    try {
                        f.contentWindow?.postMessage({ type: 'switcher-keyboard-numbers', enabled: on }, '*');
                    } catch (_) {}
                });
        });
    }

    // Calculate and set border radius based on wrapper height
    const updateBorderRadius = () => {
        if (searchBoxWrapper && searchBoxWrapperOuter) {
            const wrapperHeight = searchBoxWrapper.offsetHeight;
            const borderRadius = wrapperHeight / 2;
            const gradientBorderRadius = borderRadius + 2;

            searchBoxWrapper.style.borderRadius = `${borderRadius}px`;
            searchBoxWrapperOuter.style.borderRadius = `${borderRadius}px`;
            document.documentElement.style.setProperty('--search-box-wrapper-radius', `${borderRadius}px`);

            const outerComputedRadius = getComputedStyle(searchBoxWrapperOuter).borderRadius;
            const innerComputedRadius = getComputedStyle(searchBoxWrapper).borderRadius;
            
            // The ::before element needs extra radius since it extends outward by 2px
            document.documentElement.style.setProperty('--outer-border-radius', `${gradientBorderRadius}px`);
        }
        
        // Set search-switcher-button border radius to half its height
        const searchSwitcherBtn = document.querySelector('.search-switcher-button');
        if (searchSwitcherBtn) {
            const buttonHeight = searchSwitcherBtn.offsetHeight;
            const buttonBorderRadius = buttonHeight / 2;
            document.documentElement.style.setProperty('--switcher-button-radius', `${buttonBorderRadius}px`);
        }

        // Set suggestion items border radius to half the first item's height
        const firstSuggestionItem = document.querySelector('.suggestion-item');
        if (firstSuggestionItem) {
            const itemHeight = firstSuggestionItem.offsetHeight;
            const isAddressbar = document.body.classList.contains('addressbar');
            const minRadius = isAddressbar ? 10 : 15;
            const itemBorderRadius = itemHeight > 0 ? itemHeight / 2 : minRadius;
            document.documentElement.style.setProperty('--suggestion-item-radius', `${itemBorderRadius}px`);
        }
    };
    
    // Set initial border radius
    updateBorderRadius();
    
    // Update on window resize
    window.addEventListener('resize', updateBorderRadius);
    
    let firstHoverDone = false;
    
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
        // In '@' mode we don't want hover/keyboard navigation to overwrite the input,
        // otherwise it removes the '@...' the user typed.
        if (typeof typedText === 'string' && typedText.trim().startsWith('@')) {
            return;
        }
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
                if (originalTypedText) updateSearchInputForItem(selectedItem, originalTypedText);
            }
            
            selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }
    
    // ===== UPDATE SUGGESTIONS FUNCTION =====
    
    function updateSuggestions(suggestions, options = {}) {
        const isAtQuery = !!options.isAtQuery;
        const firefoxSuggestionsOnly = !!options.firefoxSuggestionsOnly;
        const localSourceMode = options.localSourceMode || '';
        const localSourceModeToType = { Bookmarks: 'bookmark', Tabs: 'tab', History: 'history', Actions: 'actions' };
        const displayType = (firefoxSuggestionsOnly && localSourceMode) ? (localSourceModeToType[localSourceMode] || 'history') : null;
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

        // Update lastTypedTextInInput early so mouseout during DOM updates below doesn't overwrite the input
        lastTypedTextInInput = searchValueTrimmed || '';
        
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
        
        // For @ query: don't add typed text as first suggestion; use suggestions as-is
        // For firefoxSuggestionsOnly (local source mode): only Firefox Suggest items, no heading
        // Otherwise: put typed text first, then local/AI suggestions
        const firefoxSuggestions = suggestions._firefoxSuggestions || [];
        let suggestionsToShow;
        if (firefoxSuggestionsOnly) {
            suggestionsToShow = firefoxSuggestions.length > 0
                ? firefoxSuggestions
                    .map(fs => (typeof fs === 'string' ? fs : (fs?.title || '')))
                    .filter(Boolean)
                    .filter(title => title.toLowerCase().trim() !== searchValueTrimmed.toLowerCase())
                : [];
        } else if (isAtQuery) {
            // For '@' mode, show only the matching options (engines + firefox sources),
            // not an extra "echo" of what the user is already typing.
            suggestionsToShow = Array.isArray(suggestions) ? suggestions : [];
        } else if (searchValueTrimmed) {
            const rest = (Array.isArray(suggestions) ? suggestions : []).filter((s) => {
                if (typeof s === 'object' && s._localSource) return false;
                return (typeof s === 'string' ? s : '').toLowerCase() !== searchValueTrimmed.toLowerCase();
            });
            suggestionsToShow = [searchValueTrimmed, ...rest];
            if (document.body.classList.contains('switcher-outside-search-box-enabled') && !isAtQuery && !firefoxSuggestionsOnly) {
                const engines = getSearchEngineSuggestionObjectsFromDropdown();
                const q = searchValueTrimmed.toLowerCase();
                const engineMatches = engines.filter((e) => e.label.toLowerCase().startsWith(q));
                suggestionsToShow = [searchValueTrimmed, ...engineMatches, ...rest];
            }
        } else {
            suggestionsToShow = Array.isArray(suggestions) ? suggestions : [];
        }
        
        if (!firefoxSuggestionsOnly && looksLikeUrl(searchValueTrimmed) && suggestionsToShow.length > 0) {
            const first = suggestionsToShow[0];
            const firstText = typeof first === 'object' && first._visitSite ? first._text : first;
            suggestionsToShow = [{ _visitSite: true, _text: firstText }, ...suggestionsToShow];
        }
        
        console.log('[UPDATE] Typed text:', searchValueTrimmed, '| Total suggestions:', suggestionsToShow.length);
        console.log('[UPDATE] Total suggestions to show:', suggestionsToShow.length);
        
        // Get Firefox suggestions metadata (already extracted above)
        console.log('[UPDATE] Firefox suggestions:', firefoxSuggestions.length);
        
        // Track AI suggestions for icon assignment (skip _localSource objects)
        if (suggestions.length > 0) {
            suggestions.forEach(suggestion => {
                if (typeof suggestion === 'object' && suggestion._localSource) return;
                const suggestionLower = (typeof suggestion === 'string' ? suggestion : '').toLowerCase();
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
        
        // Firefox type icons from icons folder
        const firefoxTypeIcons = {
            tab: 'icons/tabs.svg',
            bookmark: 'icons/star.svg',
            history: 'icons/clock.svg',
            actions: 'icons/actions.svg'
        };
        
        function addFirefoxSuggestHeading() {
            const headingLi = document.createElement('li');
            headingLi.className = 'firefox-suggest-section-heading';
            const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            iconSvg.setAttribute('class', 'firefox-suggest-heading-info-icon');
            iconSvg.setAttribute('width', '14');
            iconSvg.setAttribute('height', '14');
            iconSvg.setAttribute('viewBox', '0 0 24 24');
            iconSvg.setAttribute('fill', 'none');
            iconSvg.setAttribute('stroke', 'currentColor');
            iconSvg.setAttribute('stroke-width', '2');
            iconSvg.setAttribute('stroke-linecap', 'round');
            iconSvg.setAttribute('stroke-linejoin', 'round');
            iconSvg.setAttribute('aria-hidden', 'true');
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '12');
            circle.setAttribute('cy', '12');
            circle.setAttribute('r', '10');
            const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line1.setAttribute('x1', '12');
            line1.setAttribute('y1', '16');
            line1.setAttribute('x2', '12');
            line1.setAttribute('y2', '12');
            const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line2.setAttribute('x1', '12');
            line2.setAttribute('y1', '8');
            line2.setAttribute('x2', '12.01');
            line2.setAttribute('y2', '8');
            iconSvg.appendChild(circle);
            iconSvg.appendChild(line1);
            iconSvg.appendChild(line2);
            const iconWrap = document.createElement('span');
            iconWrap.className = 'info-icon-tooltip info-icon-tooltip-html tooltip-trigger';
            iconWrap.setAttribute('data-tooltip-position', 'top-right');
            const tooltipPop = document.createElement('span');
            tooltipPop.className = 'tooltip-popup';
            tooltipPop.innerHTML = 'History, bookmarks, and tab suggestions, plus relevant links from trusted sources and the occasional sponsored suggestion (relevant without us selling your data! <a href="https://support.mozilla.org/en-US/kb/firefox-suggest" target="_blank" rel="noopener">Learn how</a>)';
            iconWrap.appendChild(iconSvg);
            iconWrap.appendChild(tooltipPop);
            const span = document.createElement('span');
            span.textContent = 'From Firefox';
            headingLi.appendChild(span);
            headingLi.appendChild(iconWrap);
            suggestionsContent.appendChild(headingLi);
        }
        
        // Add 'From Firefox' heading above skeletons when in local source mode (empty suggestions, skeletons added separately)
        if (firefoxSuggestionsOnly && suggestionsToShow.length === 0) {
            addFirefoxSuggestHeading();
        }
        
        // Add suggestions
        if (suggestionsToShow && suggestionsToShow.length > 0) {
            console.log('[UPDATE] Adding', suggestionsToShow.length, 'suggestions');
            
            let firefoxHeadingAdded = false;
            
            suggestionsToShow.forEach((suggestionOrObj, index) => {
                const isVisitSite = typeof suggestionOrObj === 'object' && suggestionOrObj._visitSite;
                const isLocalSource = typeof suggestionOrObj === 'object' && suggestionOrObj._localSource;
                const isSearchEngineSuggestion = typeof suggestionOrObj === 'object' && suggestionOrObj._searchEngine;
                const suggestion = isVisitSite ? suggestionOrObj._text : (isLocalSource ? suggestionOrObj.label : suggestionOrObj);
                const typedTextIndex = suggestionsToShow[0]?._visitSite ? 1 : 0;
                const isTypedText = !isVisitSite && index === typedTextIndex && searchValueTrimmed && (suggestion || '').toLowerCase() === searchValueTrimmed.toLowerCase();
                const isFirefoxSuggest = firefoxTitlesSet.has((suggestion || '').toLowerCase().trim());
                
                // Add 'From Firefox' heading before first Firefox item
                if (isFirefoxSuggest && !firefoxHeadingAdded) {
                    addFirefoxSuggestHeading();
                    firefoxHeadingAdded = true;
                }
                
                // Create suggestion item
                const hasVisitSite = !!suggestionsToShow[0]?._visitSite;
                const isTopTwoWithHints = hasVisitSite && (index === 0 || index === 1);
                const li = document.createElement('li');
                li.className = 'suggestion-item' + (isFirefoxSuggest ? ' firefox-suggest-item' : '') + (isVisitSite ? ' visit-site-suggestion' : '') + (isLocalSource ? ' local-source-suggestion' : '') + (isTopTwoWithHints ? ' hint-always-visible' : '');
                if (isTypedText) {
                    li.setAttribute('data-typed-text', 'true');
                }
                if (isFirefoxSuggest) {
                    const firefoxDataForType = firefoxDataByTitle.get((suggestion || '').toLowerCase().trim());
                    const firefoxTypeForItem = displayType || (firefoxDataForType && firefoxDataForType.type) || 'history';
                    li.setAttribute('data-firefox-type', firefoxTypeForItem);
                }
                
                // Get appropriate icon (Firefox items: history=clock, bookmark=star, tab=tabs, actions)
                let iconEl;
                if (isFirefoxSuggest) {
                    const firefoxData = firefoxDataByTitle.get((suggestion || '').toLowerCase().trim());
                    const firefoxType = displayType || (firefoxData && firefoxData.type) || 'history';
                    const iconSrc = firefoxTypeIcons[firefoxType] || 'icons/clock.svg';
                    iconEl = document.createElement('img');
                    iconEl.src = iconSrc;
                    iconEl.alt = '';
                    iconEl.className = 'suggestion-icon';
                } else if (isVisitSite) {
                    iconEl = document.createElement('img');
                    iconEl.src = 'icons/globe.svg';
                    iconEl.alt = '';
                    iconEl.className = 'suggestion-icon';
                } else if (isLocalSource) {
                    iconEl = document.createElement('img');
                    iconEl.src = suggestionOrObj.icon || 'icons/star.svg';
                    iconEl.alt = '';
                    iconEl.className = 'suggestion-icon';
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
                if (isLocalSource) {
                    label.textContent = suggestion;
                } else {
                    const highlightedText = highlightMatchingText(suggestion, searchValueTrimmed, isTypedText, isGmailSuggestion);
                    label.innerHTML = highlightedText;
                }
                
                // Add separator and hint (wrap in hint-area for Firefox to allow truncate+fade)
                const separator = document.createElement('span');
                separator.className = 'suggestion-separator';
                separator.textContent = '•';
                
                const hintText = document.createElement('span');
                hintText.className = 'suggestion-hint-text';
                if (isFirefoxSuggest) {
                    const firefoxData = firefoxDataByTitle.get((suggestion || '').toLowerCase().trim());
                    const dateIso = firefoxData && firefoxData.date;
                    const firefoxType = displayType || (firefoxData && firefoxData.type) || 'history';
                    const urlDisplay = firefoxData && firefoxData.url
                        ? (firefoxData.url || '').replace(/^www\./i, '').toLowerCase()
                        : '';
                    const isTab = firefoxType === 'tab';
                    const isActions = firefoxType === 'actions';
                    const defaultContent = isTab ? 'switch-to-tab' : (isActions ? 'open-link' : (urlDisplay || ''));
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
                        } else if (isActions) {
                            defaultPart.textContent = urlDisplay || 'Open';
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
                        hintText.textContent = 'Search with ' + getCurrentSearchEngineLabel();
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
                    const moreIcon = document.createElement('span');
                    moreIcon.className = 'firefox-suggest-more-icon';
                    moreIcon.textContent = '⋯';
                    moreIcon.setAttribute('aria-hidden', 'true');
                    li.appendChild(moreIcon);
                } else {
                    if (isLocalSource) {
                        hintText.dataset.searchHint = isSearchEngineSuggestion
                            ? 'Search with ' + suggestion
                            : 'Search in ' + suggestion;
                    } else if (!isVisitSite) {
                        hintText.dataset.searchHint = 'Search with ' + getCurrentSearchEngineLabel();
                    }
                    li.appendChild(separator);
                    li.appendChild(hintText);
                }
                
                // Click is handled by delegated handler on suggestionsContent (handles static + dynamic items)
                
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
        // In '@' mode, we don't want to auto-highlight the top row.
        selectedSuggestionIndex = isAtQuery ? -1 : (searchValueTrimmed ? 0 : -1);
        lastTypedTextInInput = searchValueTrimmed || '';
        lastHoveredItemForInput = null;
        updateSelectedSuggestion(false);
        
        // Suppress hover until mouse moves to a new item (e.g. when AI suggestions return)
        if (options.suppressHover && suggestionsList) {
            suggestionsList.classList.add('suggestions-suppress-hover');
        } else if (suggestionsList) {
            suggestionsList.classList.remove('suggestions-suppress-hover');
        }
        // Recalculate suggestion item radius when suggestions change (items may now be visible)
        requestAnimationFrame(() => updateBorderRadius());
    }
    
    // ===== CLEAR BUTTON =====
    
    function looksLikeUrl(text) {
        const t = (text || '').trim();
        if (!t) return false;
        const knownTlds = /\.(com|org|net|edu|gov|io|co|uk|de|fr|au|ca|jp|info|biz|me|app|dev)($|\/)/i;
        return knownTlds.test(t) && !/\s/.test(t);
    }
    
    function updateClearButton() {
        if (searchClearButton && searchInput) {
            if (searchInput.value.trim().length > 0) {
                searchClearButton.style.display = 'flex';
            } else {
                searchClearButton.style.display = 'none';
            }
        }
    }

    function updateTypedState() {
        if (searchContainer && searchInput) {
            searchContainer.classList.toggle('search-has-typed-input', searchInput.value.trim().length > 0);
        }
    }
    
    function updateSearchUrlButton() {
        if (searchUrlButton && searchInput) {
            const showUrl = looksLikeUrl(searchInput.value);
            searchUrlButton.style.display = showUrl ? 'flex' : 'none';
            searchUrlButton.title = showUrl ? 'Search for URL' : '';
        }
        if (searchButton && searchInput) {
            searchButton.title = looksLikeUrl(searchInput.value) ? 'Visit site' : 'Search';
        }
    }
    
    updateSearchUrlButton();
    
    if (searchClearButton && searchInput) {
        searchClearButton.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent input from blurring
        });
        
        searchClearButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[CLEAR] Clear button clicked');
            
            searchInput.value = '';
            updateSearchUrlButton();
            updateTypedState();
            const defaultSuggestions = ['hoka', '13 in macbook air', 'coffee machines for sale', 'taylor swift', 'coffee grinder'];
            updateSuggestions(defaultSuggestions);
            currentDisplayedSuggestions = defaultSuggestions;
            searchInput.focus();
            
            let done = false;
            const hideButton = () => {
                if (done) return;
                done = true;
                searchClearButton.classList.remove('clearing');
                searchClearButton.style.display = 'none';
            };
            searchClearButton.classList.add('clearing');
            const svg = searchClearButton.querySelector('svg');
            if (svg) {
                svg.addEventListener('animationend', hideButton, { once: true });
                setTimeout(hideButton, 850);
            } else {
                hideButton();
            }
        });
    }
    
    if (searchUrlButton && searchInput) {
        searchUrlButton.addEventListener('mousedown', (e) => e.preventDefault());
        searchUrlButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const url = searchInput.value.trim();
            if (looksLikeUrl(url)) {
                const toOpen = /^https?:\/\//i.test(url) ? url : 'https://' + url;
                window.open(toOpen, '_blank');
            }
        });
    }
    
    // ===== INPUT EVENT HANDLER =====
    if (searchInput) {
        searchInput.addEventListener('input', async (event) => {
            originalTypedText = ''; // Reset so next keyboard nav captures current typed text
            updateClearButton();
            updateSearchUrlButton();
            updateTypedState();
            console.log('[INPUT] ===== INPUT EVENT STARTED =====');
            
            const value = (event.target.value || '').toString();
            const valueLower = value.toLowerCase().trim();
            console.log('[INPUT] Raw value:', value, '| Trimmed lower:', valueLower, '| Length:', valueLower.length);
            
            // Handle empty field
            if (valueLower.length === 0) {
                const label = searchSwitcherButton?.querySelector('.switcher-button-label');
                const inLocalSourceMode = label && !label.hidden;
                if (inLocalSourceMode) {
                    console.log('[INPUT] Empty field, in local source mode - suppress suggestions');
                    suggestionsList?.classList.add('suggestions-suppress-until-typed');
                    updateSuggestions([]);
                    currentDisplayedSuggestions = [];
                    return;
                }
                console.log('[INPUT] Empty field, showing default suggestions');
                suggestionsList?.classList.remove('suggestions-suppress-until-typed');
                const defaultSuggestions = ['hoka', '13 in macbook air', 'coffee machines for sale', 'taylor swift', 'coffee grinder'];
                updateSuggestions(defaultSuggestions);
                currentDisplayedSuggestions = defaultSuggestions;
                return;
            }

            suggestionsList?.classList.remove('suggestions-suppress-until-typed');
            if (!suggestionsList?.classList.contains('suggestions-revealed')) {
                suggestionsList?.classList.add('suggestions-revealed');
            }

            const label = searchSwitcherButton?.querySelector('.switcher-button-label');
            const inLocalSourceMode = label && !label.hidden;

            // In local source mode: only show Firefox Suggestions (AI results), no search suggestions, no typed-text-as-first
            if (inLocalSourceMode) {
                if (valueLower.length < 1) {
                    updateSuggestions([], { firefoxSuggestionsOnly: true });
                    showSkeletonLoaders(4);
                    return;
                }
                const hasExistingSuggestions = currentDisplayedSuggestions.length > 0;
                if (!hasExistingSuggestions) {
                    updateSuggestions([], { firefoxSuggestionsOnly: true });
                    showSkeletonLoaders(4);
                }
                lastApiQuery = valueLower;
                try {
                    const aiSuggestions = await fetchAISuggestions(valueLower);
                    const finalQuery = searchInput.value.toLowerCase().trim();
                    if (finalQuery === valueLower) {
                        if (aiSuggestions && Array.isArray(aiSuggestions) && aiSuggestions.length > 0) {
                            const localSourceLabel = label?.textContent?.trim();
                            updateSuggestions(aiSuggestions, { firefoxSuggestionsOnly: true, suppressHover: true, localSourceMode: localSourceLabel });
                            currentDisplayedSuggestions = aiSuggestions;
                        } else {
                            updateSuggestions([], { firefoxSuggestionsOnly: true });
                        }
                    }
                } catch (error) {
                    console.error('[AI] Error fetching suggestions:', error);
                    updateSuggestions([], { firefoxSuggestionsOnly: true });
                }
                return;
            }

            // Handle @ query - show search engines + Firefox sources from the switcher
            if (valueLower.startsWith('@')) {
                const afterAt = valueLower.slice(1).trim();
                const switcherDropdown = searchSwitcherButton?.querySelector('.search-switcher-dropdown');
                const engineItems = switcherDropdown
                    ? Array.from(switcherDropdown.querySelectorAll('.dropdown-search-engines .dropdown-item')).filter(
                        el => el.querySelector('.dropdown-engine-label')
                    )
                    : [];
                const firefoxItems = switcherDropdown
                    ? Array.from(switcherDropdown.querySelectorAll('.dropdown-firefox-suggestions .dropdown-item'))
                    : [];
                const localSources = engineItems
                    .map((item) => {
                        const label = getEngineLabel(item);
                        const iconEl = item.querySelector('.dropdown-engine-icon, .dropdown-icon');
                        const icon = iconEl?.getAttribute('src') || '';
                        if (!label) return null;
                        return { _localSource: true, _searchEngine: true, label, icon };
                    })
                    .filter(Boolean)
                    .concat(
                        firefoxItems
                            .map((item) => {
                                const label = item.querySelector('span')?.textContent?.trim() || '';
                                const iconEl = item.querySelector('.dropdown-icon, .dropdown-engine-icon');
                                const icon = iconEl?.getAttribute('src') || '';
                                if (!label) return null;
                                return { _localSource: true, label, icon };
                            })
                            .filter(Boolean)
                    );
                const matching = afterAt
                    ? localSources.filter(s => s.label.toLowerCase().startsWith(afterAt))
                    : localSources;
                updateSuggestions(matching, { isAtQuery: true });
                currentDisplayedSuggestions = matching;
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
    
    if (searchInput && searchContainer) {
        let autoOpenedSwitcherOnFocus = false;
        searchInput.addEventListener('focus', () => {
            if (restoringFocusFromSwitcher) {
                restoringFocusFromSwitcher = false;
                searchContainer.classList.add('focused');
                if (suggestionsList) suggestionsList.classList.add('suggestions-revealed');
                requestAnimationFrame(() => requestAnimationFrame(() => updateLogoPositionForSearchBar({ skipWhenLogoOnLeft: true })));
                return;
            }
            if (closingSwitcherWithoutSuggestions) {
                closingSwitcherWithoutSuggestions = false;
                searchInput?.blur();
                return;
            }
            if (isRestoringFocus) {
                isRestoringFocus = false;
                searchContainer.classList.add('focused');
                if (suggestionsList) suggestionsList.classList.add('suggestions-revealed');
                requestAnimationFrame(() => requestAnimationFrame(() => updateLogoPositionForSearchBar({ skipWhenLogoOnLeft: true })));
                return;
            }
            // Add focused class to expand width
            searchContainer.classList.add('focused');
            requestAnimationFrame(() => requestAnimationFrame(() => updateLogoPositionForSearchBar({ skipWhenLogoOnLeft: true })));
            suggestionsList?.classList.remove('suggestions-revealed');
            
            // Reset first hover flag
            firstHoverDone = false;
            
            const label = searchSwitcherButton?.querySelector('.switcher-button-label');
            const inLocalSourceMode = label && !label.hidden;
            const inputEmpty = !searchInput?.value?.trim();
            if (inLocalSourceMode && inputEmpty) {
                suggestionsList?.classList.add('suggestions-suppress-until-typed');
                updateSuggestions([]);
                return;
            }
            suggestionsList?.classList.remove('suggestions-suppress-until-typed');
            
            // Disable hover states during transition
            if (suggestionsList) {
                suggestionsList.classList.add('transitioning');
                const onRevealed = (e) => {
                    if (e.propertyName !== 'max-height') return;
                    suggestionsList.removeEventListener('transitionend', onRevealed);
                    if (searchContainer.classList.contains('focused')) {
                        suggestionsList.classList.add('suggestions-revealed');
                    }
                };
                suggestionsList.addEventListener('transitionend', onRevealed);
                // Remove transitioning class and enable first-hover after transition completes (0.42s)
                setTimeout(() => {
                    suggestionsList.classList.remove('transitioning');
                    suggestionsList.classList.add('first-hover-fade');
                }, 420);
            }

            // If the switcher is positioned outside the search box, open it alongside the focus expansion.
            if (document.body.classList.contains('switcher-outside-search-box-enabled') && searchSwitcherButton) {
                const dropdown = searchSwitcherButton.querySelector('.search-switcher-dropdown');
                autoOpenedSwitcherOnFocus = true;
                searchSwitcherButton.classList.add('open');
                searchSwitcherButton.classList.remove('switcher-opened-by-keyboard');
                dropdown?.classList.remove('dropdown-revealed');
                try {
                    // Ensure it starts from the top before the user sees it.
                    const scrollEl = searchSwitcherButton.querySelector('.dropdown-engines-firefox-scroll');
                    if (scrollEl) {
                        const prev = scrollEl.style.scrollBehavior;
                        scrollEl.style.scrollBehavior = 'auto';
                        scrollEl.scrollTop = 0;
                        scrollEl.scrollLeft = 0;
                        void scrollEl.offsetHeight;
                        scrollEl.style.scrollBehavior = prev;
                    }
                } catch (_) {}
                try {
                    // Best-effort: reuse the same CSS max-height variable the dropdown uses.
                    const rect = dropdown?.getBoundingClientRect?.();
                    if (rect && dropdown) {
                        const bottomPadding = 8;
                        const available = Math.floor(window.innerHeight - rect.top - bottomPadding);
                        dropdown.style.setProperty('--switcher-dropdown-max-height', Math.max(0, available) + 'px');
                    }
                } catch (_) {}
                if (dropdown) {
                    const onDropRevealed = (ev) => {
                        if (ev.propertyName !== 'max-height') return;
                        dropdown.removeEventListener('transitionend', onDropRevealed);
                        if (searchSwitcherButton.classList.contains('open')) {
                            dropdown.classList.add('dropdown-revealed');
                            syncSearchSwitcherDropdownWidth();
                            requestAnimationFrame(() => syncSearchSwitcherDropdownWidth());
                        }
                    };
                    dropdown.addEventListener('transitionend', onDropRevealed);
                }
            } else {
                autoOpenedSwitcherOnFocus = false;
            }
        });
        
        searchInput.addEventListener('blur', () => {
            if (inspectSuggestions) return;
            // If the switcher was auto-opened for the outside-of-box mode, close it on blur.
            if (autoOpenedSwitcherOnFocus && searchSwitcherButton?.classList.contains('open')) {
                const dropdown = searchSwitcherButton.querySelector('.search-switcher-dropdown');
                dropdown?.classList.remove('dropdown-revealed');
                searchSwitcherButton.classList.remove('switcher-opened-by-keyboard', 'switcher-suppress-hover');
                searchSwitcherButton.querySelectorAll('.dropdown-item').forEach((item) => item.classList.remove('highlighted'));
                beginSwitcherClosingShapeHoldUntilDropdownAnimation(searchSwitcherButton);
                forceCloseSearchSwitcherSubPanels();
                searchSwitcherButton.classList.remove('open');
                autoOpenedSwitcherOnFocus = false;
            } else if (searchSwitcherButton?.classList.contains('open')) {
                return;
            }
            // Capture focused state before closeSuggestionsPanel removes it (for window blur restore)
            wasFocusedBeforeBlur = searchContainer.classList.contains('focused');
            setTimeout(() => {
                if (window.__prototypeOptionsBlurSuppressUntil && Date.now() < window.__prototypeOptionsBlurSuppressUntil) {
                    return;
                }
                if (document.activeElement?.closest?.('.bottom-left-panel')) {
                    return;
                }
                closeSuggestionsPanel();
            }, 0);
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

        if (clearCacheButton && window === window.top && !document.body.classList.contains('addressbar')) {
            clearCacheButton.addEventListener('click', async () => {
                clearCacheButton.disabled = true;
                try {
                    // Reset prototype settings, but preserve "recent searches" to simulate an in-use browser.
                    const preservedSearchHistory = localStorage.getItem('search_history');

                    const keysToRemove = [
                        'ai_provider',
                        'reduced_motion_enabled',
                        BACKGROUND_SWATCH_KEY,
                        'pale_grey_background_enabled',
                        SEARCH_BORDER_COLOR_KEY,
                        'gradient_search_border_enabled',
                        PIN_DEFAULT_SEARCH_ENGINE_ENABLED_KEY,
                        UNDERLINE_SEARCH_ENGINES_ENABLED_KEY,
                        KEYBOARD_SWITCHER_NUMBERS_ENABLED_KEY,
                        TWELVE_SEARCH_ENGINES_ENABLED_KEY,
                        SEARCH_ENGINE_LIST_MODE_KEY,
                        SWITCHER_OUTSIDE_SEARCH_BOX_ENABLED_KEY,
                        STANDALONE_SEARCH_BOX_VISIBLE_KEY,
                        QUICK_BUTTONS_VISIBLE_KEY,
                        SEARCH_ENGINE_ORDER_KEY,
                        FIREFOX_SUGGESTIONS_ENABLED_KEY,
                        'inspectSuggestions'
                    ];
                    keysToRemove.forEach((k) => {
                        try {
                            localStorage.removeItem(k);
                        } catch (_) {}
                    });
                    // Explicit Google for all three surfaces (main / address bar / standalone). Removing keys
                    // alone left nulls that iframe seed skipped, so embedded iframes could keep stale defaults.
                    setDefaultSearchEngineStorageItem(DEFAULT_SEARCH_ENGINE_KEY_MAIN, 'Google');
                    setDefaultSearchEngineStorageItem(DEFAULT_SEARCH_ENGINE_KEY_ADDRESSBAR, 'Google');
                    setDefaultSearchEngineStorageItem(DEFAULT_SEARCH_ENGINE_KEY_STANDALONE, 'Google');

                    // Clear cached suggestion blobs, keep history.
                    const prefixKeys = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (!k) continue;
                        if (k.startsWith('ai_suggestions_') || k.startsWith('firefox_suggestions_')) {
                            prefixKeys.push(k);
                        }
                    }
                    prefixKeys.forEach((k) => {
                        try { localStorage.removeItem(k); } catch (_) {}
                    });

                    if (preservedSearchHistory != null) {
                        localStorage.setItem('search_history', preservedSearchHistory);
                    }
                    console.log('[CACHE] Reset prototype settings (preserved search_history)');

                    if ('caches' in window && typeof window.caches?.keys === 'function') {
                        try {
                            const cacheKeys = await window.caches.keys();
                            await Promise.all(cacheKeys.map((k) => window.caches.delete(k)));
                            console.log('[CACHE] Cleared Cache Storage entries:', cacheKeys.length);
                        } catch (e) {
                            console.warn('[CACHE] Cache Storage clear failed:', e);
                        }
                    }

                    AI_PROVIDER = 'openai';
                    underlineSearchEnginesEnabled = false;

                    const enginesContainerReset = searchSwitcherButton?.querySelector('.dropdown-search-engines');
                    if (enginesContainerReset) {
                        const sortSection = enginesContainerReset.querySelector('.engines-sort-section');
                        const anchor = sortSection || null;
                        const byLabel = new Map();
                        enginesContainerReset.querySelectorAll('.dropdown-item').forEach((item) => {
                            const label = getEngineLabel(item);
                            if (label) byLabel.set(label, item);
                        });
                        DEFAULT_MAIN_PAGE_ENGINE_ORDER.forEach((label) => {
                            const item = byLabel.get(label);
                            if (item) enginesContainerReset.insertBefore(item, anchor);
                        });
                        if (sortSection) {
                            const items = Array.from(enginesContainerReset.children).filter(
                                (c) => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
                            );
                            const labels = items.map((i) => getEngineLabel(i));
                            const sorted = [...labels].sort((a, b) => a.localeCompare(b));
                            sortSection.hidden = labels.length === sorted.length && labels.every((l, i) => l === sorted[i]);
                        }
                        const googlePinned = enginesContainerReset.querySelector('.dropdown-item-pinned');
                        if (googlePinned) {
                            applySelectedSearchSource(googlePinned);
                            setPinnedEngine(googlePinned);
                        }
                        ensureRowActions();
                        updateKeyboardNumbers();
                    }
                    syncSearchSettingsDefaultEngineSelects();

                    if (reducedMotionCheckbox) {
                        reducedMotionCheckbox.checked = false;
                        document.body.classList.remove('reduced-motion');
                    }
                    if (pinDefaultCheckbox) {
                        pinDefaultCheckbox.checked = false;
                        document.body.classList.remove('pin-default-enabled');
                    }
                    updateDefaultBadge();

                    document.querySelectorAll('.search-engines-count-radio').forEach((radio) => {
                        radio.checked = radio.value === '12';
                    });
                    applySearchEnginesCountMode(true);

                    applySearchEnginesDisplayMode('list');

                    const standaloneCbReset = document.querySelector('.standalone-search-box-checkbox');
                    if (standaloneCbReset) {
                        standaloneCbReset.checked = false;
                        document.body.classList.remove('standalone-search-box-visible');
                    }

                    document.body.dataset.background = DEFAULT_BACKGROUND_SWATCH;
                    try {
                        localStorage.setItem(BACKGROUND_SWATCH_KEY, DEFAULT_BACKGROUND_SWATCH);
                    } catch (_) {}
                    document.querySelectorAll('.background-swatch').forEach((btn) => {
                        const current = document.body.dataset.background || 'gradient';
                        btn.setAttribute('aria-pressed', btn.dataset.background === current ? 'true' : 'false');
                    });

                    const borderCleared = applySearchBorderColorVariable(SEARCH_BORDER_COLOR_DEFAULT);
                    document.querySelectorAll('.search-border-swatch').forEach((btn) => {
                        const bn = normalizeSearchBorderColorInput(btn.dataset.borderColor);
                        btn.setAttribute('aria-pressed', bn === borderCleared ? 'true' : 'false');
                    });

                    const underlineCbReset = document.querySelector('.underline-search-engines-checkbox');
                    if (underlineCbReset) underlineCbReset.checked = false;
                    clearEngineInitialUnderlines();

                    const kbdCbReset = document.querySelector('.keyboard-switcher-numbers-checkbox');
                    if (kbdCbReset) {
                        kbdCbReset.checked = true;
                        document.body.classList.add('keyboard-switcher-numbers-enabled');
                    }

                    if (typeof applySearchEngineListMode === 'function') {
                        applySearchEngineListMode('closed', { animate: false });
                    } else if (typeof applyPinnedMenuState === 'function') {
                        applyPinnedMenuState(false, { animate: false });
                    } else {
                        document.body.classList.remove(
                            'switcher-outside-search-box-enabled',
                            'search-engine-list-mode-pinned-right'
                        );
                        try {
                            localStorage.setItem(SWITCHER_OUTSIDE_SEARCH_BOX_ENABLED_KEY, 'false');
                        } catch (_) {}
                        const selReset = document.getElementById('search-engine-list-mode-select');
                        if (selReset) {
                            try {
                                selReset.value = 'closed';
                            } catch (_) {}
                        }
                    }

                    const qbtReset = document.getElementById('quick-buttons-toggle');
                    if (qbtReset) {
                        const icon = qbtReset.querySelector('.quick-buttons-icon');
                        const labelEl = qbtReset.querySelector('.quick-buttons-label');
                        qbtReset.dataset.visibility = 'hidden';
                        if (icon) icon.src = 'icons/eye.svg';
                        if (labelEl) labelEl.textContent = 'Show one-off buttons';
                    }

                    restoreFirefoxSuggestionsState();

                    forceCloseSearchSwitcherSubPanels();
                    searchSwitcherButton?.querySelector('.search-switcher-dropdown')?.classList.remove('switcher-dropdown--closing');
                    searchSwitcherButton?.classList.remove('open', 'switcher-opened-by-keyboard', 'switcher-suppress-hover');
                    searchSwitcherButton?.querySelectorAll('.dropdown-item').forEach((item) => item.classList.remove('highlighted'));
                    searchSwitcherButton?.querySelector('.search-switcher-dropdown')?.classList.remove('dropdown-revealed');

                    selectedSuggestionIndex = -1;
                    hoveredSuggestionIndex = -1;
                    originalTypedText = '';
                    lastTypedTextInInput = '';
                    lastHoveredItemForInput = null;
                    lastApiQuery = '';
                    aiSuggestionsSet = new Set();
                    firstHoverDone = false;

                    if (inspectSuggestions) {
                        searchContainer.classList.add('focused');
                        suggestionsList?.classList.add('suggestions-revealed');
                        suggestionsList?.classList.remove('suggestions-suppress-until-typed');
                        searchInput.value = 'x';
                        searchContainer.classList.add('search-has-typed-input');
                        updateClearButton();
                        updateSearchUrlButton();
                    } else {
                        searchInput.value = '';
                        updateClearButton();
                        updateSearchUrlButton();
                        updateTypedState();
                        // Keep the panel open and re-render the "recent searches" after reset.
                        searchContainer?.classList.add('focused');
                        suggestionsList?.classList.add('suggestions-revealed');
                        suggestionsList?.classList.remove('suggestions-suppress-until-typed');

                        restoringFocusFromSwitcher = true;
                        requestAnimationFrame(() => searchInput?.focus({ preventScroll: true }));

                        const history = getSearchHistory();
                        const defaultSuggestions = ['hoka', '13 in macbook air', 'coffee machines for sale', 'taylor swift', 'coffee grinder'];
                        const suggestionsToShow = history.length ? history.slice(0, 8) : defaultSuggestions;
                        updateSuggestions(suggestionsToShow);
                        currentDisplayedSuggestions = suggestionsToShow;
                    }

                    // Ensure switcher scroll is already at top after a reset (no visible jump on open).
                    try {
                        const scrollEl = searchSwitcherButton?.querySelector('.dropdown-engines-firefox-scroll');
                        if (scrollEl) {
                            const prev = scrollEl.style.scrollBehavior;
                            scrollEl.style.scrollBehavior = 'auto';
                            scrollEl.scrollTop = 0;
                            scrollEl.scrollLeft = 0;
                            void scrollEl.offsetHeight;
                            scrollEl.style.scrollBehavior = prev;
                        }
                    } catch (_) {}

                    const iframeReset = document.querySelector('.addressbar-iframe');
                    const standaloneIframeReset = document.querySelector('.standalone-search-box-iframe');
                    [iframeReset, standaloneIframeReset].filter(Boolean).forEach((f) => {
                        const src = f.getAttribute('src');
                        if (src) f.src = src;
                    });

                    requestAnimationFrame(() => updateLogoPositionForSearchBar());

                    if (clearCacheSuccessTimer) {
                        clearTimeout(clearCacheSuccessTimer);
                        clearCacheSuccessTimer = null;
                    }
                    clearCacheButton.classList.add('clear-cache-button--success');
                    clearCacheSuccessTimer = setTimeout(() => {
                        clearCacheButton.classList.remove('clear-cache-button--success');
                        clearCacheButton.disabled = false;
                        clearCacheSuccessTimer = null;
                    }, 2500);
                } catch (e) {
                    console.error('[CACHE] Clear cache failed:', e);
                    clearCacheButton.disabled = false;
                }
            });
        }

        // Inspect mode: keep suggestions panel open for HTML inspection (blur is skipped above)
        if (inspectSuggestions) {
            searchContainer.classList.add('focused');
            suggestionsList?.classList.add('suggestions-revealed');
            suggestionsList?.classList.remove('suggestions-suppress-until-typed');
            searchInput.value = 'x';
            searchContainer.classList.add('search-has-typed-input');
        }
    }
    
    // Shift key toggles 'Switch to Tab' / 'Open in a New Tab' on visible buttons
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Shift') {
            document.querySelectorAll('.firefox-switch-tab-button').forEach(btn => {
                btn.textContent = 'Open in a New Tab';
            });
        }
    });
    document.addEventListener('keyup', (event) => {
        if (event.key === 'Shift') {
            document.querySelectorAll('.firefox-switch-tab-button').forEach(btn => {
                btn.textContent = 'Switch to Tab';
            });
        }
    });

    // Handle Escape key: close switcher and suggestions together, or deselect search input
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            const switcherOpen = searchSwitcherButton?.classList.contains('open');
            if (switcherOpen) {
                if (document.body.classList.contains('switcher-outside-search-box-enabled')) {
                    // In outside mode, the switcher is pinned open during search.
                    return;
                }
                searchSwitcherButton.classList.remove('switcher-opened-by-keyboard');
                searchSwitcherButton.querySelector('.search-switcher-dropdown')?.classList.remove('dropdown-revealed');
                forceCloseSearchSwitcherSubPanels();
                beginSwitcherClosingShapeHoldUntilDropdownAnimation(searchSwitcherButton);
                searchSwitcherButton.classList.remove('open', 'switcher-suppress-hover');
                if (searchContainer?.classList.contains('focused')) {
                    closeSuggestionsPanel();
                } else if (searchSwitcherButton?.contains(document.activeElement)) {
                    document.activeElement?.blur?.();
                }
                return;
            }
            if (searchInput && document.activeElement === searchInput) {
                searchInput.blur();
            }
        }
        const switcherOpen = searchSwitcherButton?.classList.contains('open');
        const switcherKeyboardMode = searchSwitcherButton?.classList.contains('switcher-opened-by-keyboard');
        if (switcherOpen && !event.altKey) {
            const pinnedOpen = document.body.classList.contains('switcher-outside-search-box-enabled');
            const isPlainLetterKey = /^[a-z]$/i.test(event.key) && !event.ctrlKey && !event.metaKey;
            if (!pinnedOpen && isPlainLetterKey) {
                const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
                const engineItems = enginesContainer ? Array.from(enginesContainer.children).filter(
                    c => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
                ) : [];
                const keyLetter = event.key.toUpperCase();
                const match = engineItems.find((item) => {
                    const label = getEngineLabel(item);
                    return label && label.trim().charAt(0).toUpperCase() === keyLetter;
                });
                if (match) {
                    event.preventDefault();
                    applySelectedSearchSource(match);
                    const query = (searchInput?.value || '').trim();
                    if (query) {
                        runSearchWithEngine(query, getEngineLabel(match), true);
                    }
                    if (!pinnedOpen) {
                        searchSwitcherButton.querySelector('.search-switcher-dropdown')?.classList.remove('dropdown-revealed');
                        forceCloseSearchSwitcherSubPanels();
                        beginSwitcherClosingShapeHoldUntilDropdownAnimation(searchSwitcherButton);
                        searchSwitcherButton.classList.remove('open', 'switcher-suppress-hover', 'switcher-opened-by-keyboard');
                    }
                    switcherHighlightedIndex = -1;
                    searchSwitcherButton.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('highlighted'));
                    if (searchContainer?.classList.contains('focused')) {
                        restoreFocusAndOpaqueSuggestions();
                    } else if (searchSwitcherButton?.contains(document.activeElement)) {
                        document.activeElement?.blur?.();
                    }
                    return;
                }
            }
            if (!pinnedOpen && switcherKeyboardMode && /^[1-9]$/.test(event.key)) {
                const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
                const engineItems = enginesContainer ? Array.from(enginesContainer.children).filter(
                    c => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
                ) : [];
                const index = parseInt(event.key, 10) - 1;
                if (index >= 0 && index < engineItems.length) {
                    event.preventDefault();
                    const item = engineItems[index];
                    applySelectedSearchSource(item);
                    const query = (searchInput?.value || '').trim();
                    if (query) {
                        runSearchWithEngine(query, getEngineLabel(item), true);
                    }
                    if (!pinnedOpen) {
                        searchSwitcherButton.querySelector('.search-switcher-dropdown')?.classList.remove('dropdown-revealed');
                        forceCloseSearchSwitcherSubPanels();
                        beginSwitcherClosingShapeHoldUntilDropdownAnimation(searchSwitcherButton);
                        searchSwitcherButton.classList.remove('open', 'switcher-suppress-hover', 'switcher-opened-by-keyboard');
                    }
                    switcherHighlightedIndex = -1;
                    searchSwitcherButton.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('highlighted'));
                    if (searchContainer?.classList.contains('focused')) {
                        restoreFocusAndOpaqueSuggestions();
                    } else if (searchSwitcherButton?.contains(document.activeElement)) {
                        document.activeElement?.blur?.();
                    }
                    return;
                }
            }
            const firefoxToggle = document.activeElement?.closest?.('.dropdown-firefox-toggle');
            if (firefoxToggle && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                toggleFirefoxSuggestionCheckbox(firefoxToggle);
                return;
            }
            const dropdown = searchSwitcherButton?.querySelector('.search-switcher-dropdown');
            const dropdownItems = dropdown ? Array.from(dropdown.querySelectorAll('.dropdown-item')) : [];
            const count = dropdownItems.length;
            if (event.key === 'Enter' && switcherHighlightedIndex >= 0 && switcherHighlightedIndex < count) {
                event.preventDefault();
                const item = dropdownItems[switcherHighlightedIndex];
                if (item.id !== 'quick-buttons-toggle') {
                    console.log('[SWITCHER KEYBOARD] Enter pressed on highlighted item, applying selection and closing');
                    applySelectedSearchSource(item);
                    const query = (searchInput?.value || '').trim();
                    if (item.querySelector('.dropdown-engine-label') && query) {
                        runSearchWithEngine(query, getEngineLabel(item), true);
                    }
                    if (!pinnedOpen) {
                        dropdown?.classList.remove('dropdown-revealed');
                        forceCloseSearchSwitcherSubPanels();
                        beginSwitcherClosingShapeHoldUntilDropdownAnimation(searchSwitcherButton);
                        searchSwitcherButton.classList.remove('open', 'switcher-suppress-hover');
                    }
                    switcherHighlightedIndex = -1;
                    dropdownItems.forEach(i => i.classList.remove('highlighted'));
                    if (searchContainer?.classList.contains('focused')) {
                        restoreFocusAndOpaqueSuggestions();
                    } else if (searchSwitcherButton?.contains(document.activeElement)) {
                        document.activeElement?.blur?.();
                    }
                    console.log('[SWITCHER KEYBOARD] Closed. Open state now:', searchSwitcherButton.classList.contains('open'));
                }
            } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                if (count > 0) {
                    event.preventDefault();
                    searchSwitcherButton.classList.add('switcher-suppress-hover');
                    const startIndex = switcherHighlightedIndex >= 0 ? switcherHighlightedIndex : switcherHoveredIndex;
                    if (event.key === 'ArrowDown') {
                        switcherHighlightedIndex = startIndex >= 0 ? (startIndex + 1) % count : 0;
                    } else {
                        switcherHighlightedIndex = startIndex >= 0 ? (startIndex - 1 + count) % count : count - 1;
                    }
                    dropdownItems.forEach((item, i) => item.classList.toggle('highlighted', i === switcherHighlightedIndex));
                    dropdownItems[switcherHighlightedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            }
        }
    });
    
    // Backspace/Delete at start in local source mode → return to default search engine (only when cursor at start, not when text is selected)
    if (searchInput && searchSwitcherButton) {
        searchInput.addEventListener('keydown', (event) => {
            if (event.key !== 'Backspace' && event.key !== 'Delete') return;
            const label = searchSwitcherButton?.querySelector('.switcher-button-label');
            if (!label || label.hidden) return;
            const selStart = searchInput.selectionStart ?? 0;
            const selEnd = searchInput.selectionEnd ?? 0;
            if (selStart !== 0 || selStart !== selEnd) return;
            event.preventDefault();
            const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
            const pinnedItem = enginesContainer?.querySelector('.dropdown-item-pinned');
            if (pinnedItem) applySelectedSearchSource(pinnedItem);
        });
    }

    // @bookmarks, @history, @tabs, @actions - switch search type on space (only when search engine selected)
    if (searchInput && searchSwitcherButton) {
        searchInput.addEventListener('keydown', (event) => {
            if (event.key !== ' ') return;
            const label = searchSwitcherButton?.querySelector('.switcher-button-label');
            if (label && !label.hidden) return;
            const value = searchInput.value;
            const atKeywords = ['@bookmarks', '@history', '@tabs', '@actions'];
            const lower = value.toLowerCase();
            for (const kw of atKeywords) {
                if (lower.endsWith(kw)) {
                    event.preventDefault();
                    const newValue = value.slice(0, -kw.length).trim();
                    searchInput.value = newValue;
                    searchInput.setSelectionRange(newValue.length, newValue.length);
                    const labelMap = { '@bookmarks': 'Bookmarks', '@history': 'History', '@tabs': 'Tabs', '@actions': 'Actions' };
                    const targetLabel = labelMap[kw];
                    const dropdown = searchSwitcherButton.querySelector('.search-switcher-dropdown');
                    const item = dropdown ? Array.from(dropdown.querySelectorAll('.dropdown-item')).find(el => el.textContent.trim() === targetLabel) : null;
                    if (item) {
                        applySelectedSearchSource(item);
                        if (!newValue) {
                            suggestionsList?.classList.add('suggestions-suppress-until-typed');
                            updateSuggestions([]);
                        }
                    }
                    return;
                }
            }
        });
    }

    // Ctrl/Cmd + Up/Down: cycle search engine on the switcher button without opening the menu (or sub-panels).
    // Registered before the suggestions keydown so stopImmediatePropagation blocks suggestion arrow handling.
    if (searchInput && searchSwitcherButton) {
        searchInput.addEventListener('keydown', (event) => {
            if (!(event.ctrlKey || event.metaKey)) return;
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            if (event.repeat) {
                event.preventDefault();
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            cycleSwitcherEngineFromSearchField(event.key === 'ArrowDown' ? 1 : -1);
        });
    }

    // Keyboard navigation (ArrowUp, ArrowDown, Enter); Alt+ArrowUp/Down opens search engine switcher
    if (searchInput && suggestionsList) {
        searchInput.addEventListener('keydown', (event) => {
            const dropdown = searchSwitcherButton?.querySelector('.search-switcher-dropdown');
            const dropdownItems = dropdown ? Array.from(dropdown.querySelectorAll('.dropdown-item')) : [];
            
            if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
                event.preventDefault();
                if (searchSwitcherButton) {
                    searchSwitcherButton.classList.add('open', 'switcher-suppress-hover', 'switcher-opened-by-keyboard');
                    resetSwitcherScrollPositions();
                    searchInput.blur();
                    searchSwitcherButton.focus();
                    switcherHighlightedIndex = -1;
                    dropdownItems.forEach((item) => item.classList.remove('highlighted'));
                    updateKeyboardNumbers();
                }
                return;
            }
            
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
                const selectedItem = navigableItems[selectedSuggestionIndex];
                if (selectedItem && selectedItem.classList.contains('local-source-suggestion')) {
                    const label = selectedItem.querySelector('.suggestion-label')?.textContent?.trim();
                    if (label) {
                        const dropdown = searchSwitcherButton?.querySelector('.search-switcher-dropdown');
                        const item = dropdown ? Array.from(dropdown.querySelectorAll('.dropdown-item')).find(el => el.textContent.trim() === label) : null;
                        if (item) {
                            applySelectedSearchSource(item);
                            if (searchInput) {
                                searchInput.value = '';
                                suggestionsList?.classList.add('suggestions-suppress-until-typed');
                                updateSuggestions([]);
                                searchInput.focus();
                            }
                        }
                    }
                } else {
                    const isFirefoxArticle = selectedItem?.classList.contains('firefox-suggest-item') &&
                        ['recommendations', 'partners'].includes(selectedItem?.dataset?.firefoxType || '');
                    if (isFirefoxArticle) return;
                    const searchText = selectedItem?.querySelector('.suggestion-label')?.textContent?.trim() || searchInput?.value?.trim();
                    if (searchText) {
                        if (selectedItem?.classList.contains('visit-site-suggestion') && looksLikeUrl(searchText)) {
                            const toOpen = /^https?:\/\//i.test(searchText) ? searchText : 'https://' + searchText;
                            window.open(toOpen, '_blank');
                        } else {
                            saveToSearchHistory(searchText);
                            runSearchWithSelectedEngine(searchText);
                        }
                    }
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
                if (item !== lastHoveredItemForInput && !suggestionsList.classList.contains('keyboard-navigating') && lastTypedTextInInput) {
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
    let wasSwitcherFocusedBeforeBlur = false;
    let isRestoringFocus = false;
    
    if (searchInput && searchContainer) {
        searchInput.addEventListener('focus', () => {
            if (isRestoringFocus) {
                // Don't add focused class, it's already there
                isRestoringFocus = false;
            }
        });
        
        searchInput.addEventListener('blur', () => {
            if (searchSwitcherButton?.classList.contains('open')) {
                wasFocusedBeforeBlur = false;
            }
            // else: first blur handler already captured wasFocusedBeforeBlur before closeSuggestionsPanel
        });
        
        window.addEventListener('blur', () => {
            wasFocusedBeforeBlur = false;
            wasSwitcherFocusedBeforeBlur = false;
            const ae = document.activeElement;
            if (ae === searchInput) {
                wasFocusedBeforeBlur = true;
            } else if (searchSwitcherButton && searchSwitcherButton.contains(ae)) {
                // Show-while-typing / pin switch lives inside the switcher subtree; focus there is not "engine switcher" UX.
                const searchEngineListModeSelectEl = document.getElementById('search-engine-list-mode-select');
                const focusOnSearchEngineListModeOnly =
                    searchEngineListModeSelectEl &&
                    (ae === searchEngineListModeSelectEl || searchEngineListModeSelectEl.contains(ae));
                if (!focusOnSearchEngineListModeOnly) {
                    wasSwitcherFocusedBeforeBlur = true;
                }
            }
        });
        
        window.addEventListener('focus', () => {
            if (wasSwitcherFocusedBeforeBlur && searchSwitcherButton?.classList.contains('open')) {
                searchSwitcherButton.focus();
                wasSwitcherFocusedBeforeBlur = false;
            } else if (wasFocusedBeforeBlur) {
                isRestoringFocus = true;
                
                // Suppress transitions (class + inline for reliability)
                searchContainer.classList.add('restoring-focus');
                searchContainer.style.transition = 'none';
                if (suggestionsList) suggestionsList.style.transition = 'none';
                const logo = document.querySelector('.firefox-logo');
                if (logo) logo.style.transition = 'none';
                const oneOffButtons = document.querySelector('.one-off-buttons');
                if (oneOffButtons) oneOffButtons.style.transition = 'none';

                // Outside-of-search-box mode: keep the switcher visible when returning to the app.
                // Ensure it is already open without animating max-height on restore.
                const switcherDropdownForRestore = document.body.classList.contains('switcher-outside-search-box-enabled')
                    ? searchSwitcherButton?.querySelector('.search-switcher-dropdown')
                    : null;
                if (switcherDropdownForRestore) {
                    switcherDropdownForRestore.style.transition = 'none';
                    searchSwitcherButton.classList.add('open');
                    searchSwitcherButton.classList.remove('switcher-opened-by-keyboard');
                    switcherDropdownForRestore.classList.add('dropdown-revealed');
                    syncSearchSwitcherDropdownWidth();
                    requestAnimationFrame(() => syncSearchSwitcherDropdownWidth());
                    try {
                        const rect = switcherDropdownForRestore.getBoundingClientRect();
                        const bottomPadding = 8;
                        const available = Math.floor(window.innerHeight - rect.top - bottomPadding);
                        switcherDropdownForRestore.style.setProperty('--switcher-dropdown-max-height', Math.max(0, available) + 'px');
                    } catch (_) {}
                    try {
                        const scrollEl = searchSwitcherButton.querySelector('.dropdown-engines-firefox-scroll');
                        if (scrollEl) {
                            const prev = scrollEl.style.scrollBehavior;
                            scrollEl.style.scrollBehavior = 'auto';
                            scrollEl.scrollTop = 0;
                            scrollEl.scrollLeft = 0;
                            void scrollEl.offsetHeight;
                            scrollEl.style.scrollBehavior = prev;
                        }
                    } catch (_) {}
                }
                // Force reflow so transition:none is applied before state change
                void searchContainer.offsetHeight;
                
                // Defer focus until next frame so browser applies transition:none before state change
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        searchInput.focus();
                    });
                });
                
                // Re-enable transitions after state is restored
                setTimeout(() => {
                    searchContainer.classList.remove('restoring-focus');
                    searchContainer.style.transition = '';
                    if (suggestionsList) suggestionsList.style.transition = '';
                    if (logo) logo.style.transition = '';
                    if (oneOffButtons) oneOffButtons.style.transition = '';
                    if (switcherDropdownForRestore) switcherDropdownForRestore.style.transition = '';
                }, 100);
                
                wasFocusedBeforeBlur = false;
            }
            if (wasSwitcherFocusedBeforeBlur) {
                wasSwitcherFocusedBeforeBlur = false;
            }
        });
    }
});
