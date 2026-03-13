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

const DEFAULT_SEARCH_ENGINE_KEY = 'default_search_engine';
const SEARCH_ENGINE_ORDER_KEY = 'search_engine_order';
const FIREFOX_SUGGESTIONS_ENABLED_KEY = 'firefox_suggestions_enabled';
const PIN_DEFAULT_SEARCH_ENGINE_ENABLED_KEY = 'pin_default_search_engine_enabled';
const STANDALONE_SEARCH_BOX_VISIBLE_KEY = 'standalone_search_box_visible';
const BACKGROUND_SWATCH_KEY = 'background_swatch';
const GRADIENT_SEARCH_BORDER_ENABLED_KEY = 'gradient_search_border_enabled';
const QUICK_BUTTONS_VISIBLE_KEY = 'quick_buttons_visible';

console.log('[INIT] Script loading, checking reduced motion in localStorage');
const initialReducedMotion = localStorage.getItem('reduced_motion_enabled');
console.log('[INIT] Reduced motion in localStorage:', initialReducedMotion);

document.addEventListener('DOMContentLoaded', () => {
    console.log('[DOM] DOMContentLoaded fired');

    // Address bar iframe: parent sets width (matches search bar 57.6% / 576px); iframe reports height (including dropdown)
    if (window !== window.top) {
        window.addEventListener('message', (e) => {
            if (e.data?.type === 'gradient-search-border-off') {
                if (e.data.off) {
                    document.body.classList.add('gradient-search-border-off');
                    if (gradientAnimationId) {
                        cancelAnimationFrame(gradientAnimationId);
                        gradientAnimationId = null;
                    }
                    const existingStyle = document.getElementById('gradient-animation-style');
                    if (existingStyle) existingStyle.remove();
                } else {
                    document.body.classList.remove('gradient-search-border-off');
                }
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
            } else if (e.data?.type === 'close-switcher') {
                const btn = document.querySelector('.search-switcher-button');
                const dropdown = btn?.querySelector('.search-switcher-dropdown');
                const container = document.querySelector('.search-container');
                if (typeof logPanelState === 'function') logPanelState('close-switcher MESSAGE received');
                if (btn?.classList.contains('open')) {
                    dropdown?.classList.remove('dropdown-revealed');
                    btn.classList.remove('open', 'switcher-opened-by-keyboard', 'switcher-suppress-hover');
                    btn.querySelectorAll('.dropdown-item').forEach(item => item.classList.remove('highlighted'));
                    if (container?.classList.contains('focused')) {
                        if (typeof closeSuggestionsPanel === 'function') {
                            closeSuggestionsPanel();
                        }
                    } else if (typeof restoreFocusAndOpaqueSuggestions === 'function') {
                        restoreFocusAndOpaqueSuggestions();
                    }
                    if (typeof logPanelState === 'function') logPanelState('close-switcher MESSAGE handled');
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
            if (switcherButton?.classList.contains('open') && dropdown) {
                const dropdownRect = dropdown.getBoundingClientRect();
                const fullDropdownBottom = dropdownRect.top + dropdown.scrollHeight;
                bottom = Math.max(bottom, fullDropdownBottom);
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
                    const closeDelay = document.body.classList.contains('reduced-motion') ? 0 : 250;
                    setTimeout(scheduleHeightReports, closeDelay);
                }
            });
            switcherObserver.observe(switcherButton, { attributes: true, attributeFilter: ['class'] });
        }
    } else {
        const iframe = document.querySelector('.addressbar-iframe');
        const standaloneIframe = document.querySelector('.standalone-search-box-iframe');
        const iframes = [iframe, standaloneIframe].filter(Boolean);

        const sendPrototypeOptionsToIframes = () => {
            const gradientOff = localStorage.getItem(GRADIENT_SEARCH_BORDER_ENABLED_KEY) === 'false';
            const reducedMotion = localStorage.getItem('reduced_motion_enabled') === 'true';
            const pinDefault = localStorage.getItem(PIN_DEFAULT_SEARCH_ENGINE_ENABLED_KEY) === 'true';
            iframes.forEach(f => {
                try {
                    f.contentWindow?.postMessage({ type: 'gradient-search-border-off', off: gradientOff }, '*');
                    f.contentWindow?.postMessage({ type: 'reduced-motion', enabled: reducedMotion }, '*');
                    f.contentWindow?.postMessage({ type: 'pin-default', enabled: pinDefault }, '*');
                } catch (_) {}
            });
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
                const w = Math.min(window.innerWidth * 0.576, 576);
                iframe.style.width = w + 'px';
                if (standaloneIframe) {
                    standaloneIframe.style.width = Math.round(w / 2) + 'px';
                }
            };
            const setHeight = (e) => {
                if (e.data?.type === 'addressbar-height' && typeof e.data.height === 'number') {
                    const h = e.data.height;
                    if (e.source === iframe.contentWindow) {
                        iframe.style.height = h + 'px';
                        updateBandHeight(h);
                    } else if (standaloneIframe && e.source === standaloneIframe.contentWindow) {
                        standaloneIframe.style.height = h + 'px';
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
        document.addEventListener('click', () => {
            iframes.forEach(f => {
                try {
                    f.contentWindow?.postMessage({ type: 'close-switcher' }, '*');
                } catch (_) {}
            });
        });
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

    console.log('[DOM] Body has reduced-motion class?', document.body.classList.contains('reduced-motion'));
    const searchInput = document.querySelector('.search-input');
    const inspectSuggestions = new URLSearchParams(location.search).get('inspect') === '1' || localStorage.getItem('inspectSuggestions') === 'true';

    // Clear search input on page load
    if (searchInput) {
        searchInput.value = '';
        console.log('[DOM] Cleared search input on load');
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
    let switcherHighlightedIndex = -1;
    let switcherHoveredIndex = -1;
    let restoringFocusFromSwitcher = false;

    function logPanelState(label) {
        if (!searchContainer) return;
        const ctx = document.body.classList.contains('standalone-search-box') ? 'standalone' :
            document.body.classList.contains('addressbar') ? 'addressbar' : 'main';
        const switcherOpen = searchSwitcherButton?.classList.contains('open');
        const containerFocused = searchContainer?.classList.contains('focused');
        const suggestionsRevealed = suggestionsList?.classList.contains('suggestions-revealed');
        const transitioning = suggestionsList?.classList.contains('transitioning');
        const firstHoverFade = suggestionsList?.classList.contains('first-hover-fade');
        const inputFocused = document.activeElement === searchInput;
        let opacity = '';
        let transition = '';
        if (suggestionsList) {
            const cs = getComputedStyle(suggestionsList);
            opacity = cs.opacity;
            transition = cs.transition;
        }
        console.log(`[PANEL ${ctx}] ${label}:`, {
            switcherOpen,
            containerFocused,
            suggestionsRevealed,
            transitioning,
            firstHoverFade,
            inputFocused,
            restoringFocusFromSwitcher,
            suggestionsOpacity: opacity,
            suggestionsTransition: transition
        });
    }

    function restoreFocusAndOpaqueSuggestions() {
        logPanelState('restoreFocusAndOpaqueSuggestions START');
        restoringFocusFromSwitcher = true;
        const isAddressbar = document.body.classList.contains('addressbar');
        if (isAddressbar) {
            requestAnimationFrame(() => {
                logPanelState('restoreFocus rAF 1 (before focus)');
                requestAnimationFrame(() => {
                    logPanelState('restoreFocus rAF 2 (about to focus)');
                    searchInput?.focus();
                    logPanelState('restoreFocus rAF 2 (after focus)');
                });
            });
        } else {
            searchInput?.focus();
            logPanelState('restoreFocusAndOpaqueSuggestions AFTER focus (main)');
        }
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
        if (item.textContent.includes('Search Settings')) return;
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

    function getCurrentSearchEngineLabel() {
        const icon = searchSwitcherButton?.querySelector('.google-icon');
        if (icon?.alt) return icon.alt;
        const saved = localStorage.getItem(DEFAULT_SEARCH_ENGINE_KEY);
        return saved || 'Google';
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

    function ensureDragHandles() {
        const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        if (!enginesContainer) return;
        const engineItems = Array.from(enginesContainer.querySelectorAll('.dropdown-item')).filter(
            el => el.querySelector('.dropdown-engine-label')
        );
        const dragHandleHtml = '<span class="dropdown-item-drag-handle" title="Drag to reorder" aria-hidden="true"><span class="dropdown-item-keyboard-num" aria-hidden="true"></span><img src="icons/drag-handle.svg" alt=""></span>';
        engineItems.forEach(item => {
            if (!item.querySelector('.dropdown-item-drag-handle')) {
                const pin = item.querySelector('.dropdown-item-pin-empty, .dropdown-item-pin');
                if (pin) pin.insertAdjacentHTML('beforebegin', dragHandleHtml);
            } else if (!item.querySelector('.dropdown-item-keyboard-num')) {
                const handle = item.querySelector('.dropdown-item-drag-handle');
                if (handle && !handle.querySelector('.dropdown-item-keyboard-num')) {
                    handle.insertAdjacentHTML('afterbegin', '<span class="dropdown-item-keyboard-num" aria-hidden="true"></span>');
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
        ensureDragHandles();
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
    }
    
    // Click on search-box-wrapper focuses the input
    if (searchBoxWrapper && searchInput) {
        searchBoxWrapper.addEventListener('click', (e) => {
            // Don't focus if clicking on a button
            if (e.target.closest('.search-switcher-button') || e.target.closest('.search-button') || e.target.closest('.search-url-button')) {
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
            const switcherTooltipPinned = tooltipPinned && activeTrigger?.closest('.search-switcher-dropdown');
            if (target && searchSwitcherButton.classList.contains('open') && !switcherTooltipPinned && !window._searchEngineDragging) {
                logPanelState('SWITCHER CLOSING (suggestion hover)');
                console.log('[SUGGESTION ITEM HOVER] Closing switcher dropdown');
                searchSwitcherButton.querySelector('.search-switcher-dropdown')?.classList.remove('dropdown-revealed');
                searchSwitcherButton.classList.remove('open', 'switcher-suppress-hover');
                switcherHighlightedIndex = -1;
                searchSwitcherButton.querySelectorAll('.dropdown-item').forEach(item => item.classList.remove('highlighted'));
                restoreFocusAndOpaqueSuggestions();
                logPanelState('SWITCHER CLOSED (suggestion hover)');
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
            const clickedInsideDropdown = e.target.closest('.search-switcher-dropdown');
            const wasOpen = searchSwitcherButton.classList.contains('open');
            if (clickedInsideDropdown) {
                console.log('[SWITCHER BUTTON CLICK] Ignoring - click was inside dropdown (already handled by dropdown)');
                return;
            }
            searchSwitcherButton.classList.toggle('open');
            const isNowOpen = searchSwitcherButton.classList.contains('open');
            if (wasOpen && !isNowOpen) {
                logPanelState('SWITCHER CLOSING (toggle)');
                searchSwitcherDropdown?.classList.remove('dropdown-revealed');
                switcherHighlightedIndex = -1;
                searchSwitcherButton.classList.remove('switcher-suppress-hover');
                searchSwitcherButton.querySelectorAll('.dropdown-item').forEach(item => item.classList.remove('highlighted'));
                if (searchContainer?.classList.contains('focused')) {
                    restoreFocusAndOpaqueSuggestions();
                }
                logPanelState('SWITCHER CLOSED (toggle)');
            } else if (!wasOpen && isNowOpen) {
                logPanelState('SWITCHER OPENING');
                searchSwitcherButton.classList.remove('switcher-opened-by-keyboard');
                searchSwitcherDropdown?.classList.remove('dropdown-revealed');
                const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
                if (enginesContainer) enginesContainer.scrollTo({ top: 0, behavior: 'instant' });
                const firefoxSuggestionsContainer = searchSwitcherButton?.querySelector('.dropdown-firefox-suggestions');
                if (firefoxSuggestionsContainer) firefoxSuggestionsContainer.scrollTo({ top: 0, behavior: 'instant' });
                const onRevealed = (e) => {
                    if (e.propertyName !== 'max-height') return;
                    searchSwitcherDropdown.removeEventListener('transitionend', onRevealed);
                    if (searchSwitcherButton.classList.contains('open')) {
                        searchSwitcherDropdown.classList.add('dropdown-revealed');
                    }
                    logPanelState('SWITCHER dropdown transitionend');
                };
                searchSwitcherDropdown?.addEventListener('transitionend', onRevealed);
                searchInput.blur();
                searchSwitcherButton.focus();
                logPanelState('SWITCHER OPENED (after blur+focus)');
                searchSwitcherButton.classList.add('switcher-suppress-hover');
            }
            
            console.log('[SWITCHER CLICK] Clicked search switcher button');
            console.log('[SWITCHER CLICK] Was open:', wasOpen, '→ Now open:', isNowOpen);
            console.log('[SWITCHER CLICK] Search input focused?', document.activeElement === searchInput);
            console.log('[SWITCHER CLICK] Suggestions visible?', searchContainer?.classList.contains('focused'));
        });
        
        // When mousedown on search container (not switcher) with switcher open, focus will move to input
        // Set flag so the focus handler keeps suggestions open
        document.addEventListener('mousedown', (e) => {
            if (searchSwitcherButton?.classList.contains('open') &&
                e.target.closest('.search-container') &&
                !e.target.closest('.search-switcher-button')) {
                restoringFocusFromSwitcher = true;
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (window._searchEngineDragOccurred) {
                window._searchEngineDragOccurred = false;
                return;
            }
            if (!e.target.closest('.search-switcher-button')) {
                const wasOpen = searchSwitcherButton.classList.contains('open');
                if (wasOpen) {
                    logPanelState('SWITCHER CLOSING (click outside)');
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
                        }
                    }
                    restoringFocusFromSwitcher = false;
                    logPanelState('SWITCHER CLOSED (click outside)');
                }
                searchSwitcherButton.classList.remove('open');
            }
        });
        
        // Clear keyboard highlight when mouse enters dropdown (switch to hover mode)
        const searchSwitcherDropdown = searchSwitcherButton.querySelector('.search-switcher-dropdown');
        if (searchSwitcherDropdown) {
            searchSwitcherDropdown.addEventListener('mousemove', () => {
                if (searchSwitcherButton.classList.contains('switcher-suppress-hover')) {
                    searchSwitcherButton.classList.remove('switcher-suppress-hover');
                }
            });
            searchSwitcherDropdown.addEventListener('mouseover', (e) => {
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
                const firefoxToggleEl = e.target.closest('.dropdown-firefox-toggle');
                if (firefoxToggleEl) {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFirefoxSuggestionCheckbox(firefoxToggleEl);
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
                        if (label) localStorage.setItem(DEFAULT_SEARCH_ENGINE_KEY, label);
                        setPinnedEngine(item);
                        searchSwitcherDropdown.classList.remove('dropdown-revealed');
                        searchSwitcherButton.classList.remove('open', 'switcher-suppress-hover');
                        switcherHighlightedIndex = -1;
                        searchSwitcherButton.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('highlighted'));
                        if (searchContainer?.classList.contains('focused')) restoreFocusAndOpaqueSuggestions();
                        return;
                    }
                }
                if (!item) return;
                if (item.id === 'quick-buttons-toggle') return;
                if (item.textContent.includes('Search Settings')) return;
                logPanelState('SWITCHER CLOSING (dropdown item click)');
                console.log('[SWITCHER MOUSE] Dropdown item clicked, applying selection and closing');
                applySelectedSearchSource(item);
                searchSwitcherDropdown.classList.remove('dropdown-revealed');
                searchSwitcherButton.classList.remove('open', 'switcher-suppress-hover');
                switcherHighlightedIndex = -1;
                searchSwitcherButton.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('highlighted'));
                if (searchContainer?.classList.contains('focused')) {
                    restoreFocusAndOpaqueSuggestions();
                } else {
                    searchInput?.focus();
                }
                logPanelState('SWITCHER CLOSED (dropdown item click)');
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

            const getDropIndexFromY = (clientY) => {
                const items = getEngineItems();
                if (items.length === 0) return 0;
                const containerRect = enginesContainer.getBoundingClientRect();
                if (clientY < containerRect.top) return 0;
                if (clientY > containerRect.bottom) return items.length;
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
                if (index >= items.length) {
                    enginesContainer.insertBefore(dropMarker, sortSectionForMarker || null);
                } else {
                    enginesContainer.insertBefore(dropMarker, items[index]);
                }
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
                updateDropMarker(getDropIndexFromY(e.clientY));

                const containerRect = enginesContainer.getBoundingClientRect();
                const distFromTop = e.clientY - containerRect.top;
                const distFromBottom = containerRect.bottom - e.clientY;

                if (dragScrollInterval) {
                    clearInterval(dragScrollInterval);
                    dragScrollInterval = null;
                }
                if (distFromTop < DRAG_SCROLL_ZONE && distFromTop >= 0 && enginesContainer.scrollTop > 0) {
                    dragScrollInterval = setInterval(() => {
                        if (enginesContainer.scrollTop <= 0) {
                            clearInterval(dragScrollInterval);
                            dragScrollInterval = null;
                            return;
                        }
                        enginesContainer.scrollTop -= DRAG_SCROLL_SPEED;
                    }, 16);
                } else if (distFromBottom < DRAG_SCROLL_ZONE && distFromBottom >= 0 &&
                    enginesContainer.scrollTop < enginesContainer.scrollHeight - enginesContainer.clientHeight) {
                    const maxScroll = enginesContainer.scrollHeight - enginesContainer.clientHeight;
                    dragScrollInterval = setInterval(() => {
                        if (enginesContainer.scrollTop >= maxScroll) {
                            clearInterval(dragScrollInterval);
                            dragScrollInterval = null;
                            return;
                        }
                        enginesContainer.scrollTop += DRAG_SCROLL_SPEED;
                    }, 16);
                }
            };

            const onDragEnd = () => {
                endDrag();
            };

            enginesContainer.addEventListener('mousedown', (e) => {
                const item = e.target.closest('.dropdown-item');
                if (!item || !item.querySelector('.dropdown-engine-label')) return;
                if (e.target.closest('.dropdown-item-pin-empty, .dropdown-item-pin')) return;
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
                    updateDropMarker(getDropIndexFromY(e.clientY));
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
            const sortSection = enginesContainer.querySelector('.engines-sort-section');
            if (sortSection) {
                const engineItems = Array.from(enginesContainer.children).filter(
                    c => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
                );
                const labels = engineItems.map(i => getEngineLabel(i));
                const sorted = [...labels].sort((a, b) => a.localeCompare(b));
                sortSection.hidden = labels.length === sorted.length && labels.every((l, i) => l === sorted[i]);
            }
            updateKeyboardNumbers();
        }
        
        // Quick buttons visibility toggle
        const quickButtonsToggle = document.getElementById('quick-buttons-toggle');
        if (quickButtonsToggle) {
            const applyQuickButtonsState = (visible) => {
                const icon = quickButtonsToggle.querySelector('.quick-buttons-icon');
                const label = quickButtonsToggle.querySelector('.quick-buttons-label');
                if (visible) {
                    quickButtonsToggle.dataset.visibility = 'shown';
                    icon.src = 'icons/eye.svg';
                    label.textContent = 'Hide Quick Buttons';
                } else {
                    quickButtonsToggle.dataset.visibility = 'hidden';
                    icon.src = 'icons/eye-off.svg';
                    label.textContent = 'Show Quick Buttons';
                }
            };
            const savedQuickButtons = localStorage.getItem(QUICK_BUTTONS_VISIBLE_KEY);
            if (savedQuickButtons === 'false') {
                applyQuickButtonsState(false);
            } else {
                applyQuickButtonsState(true);
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
            const savedEngine = localStorage.getItem(DEFAULT_SEARCH_ENGINE_KEY);
            if (savedEngine) {
                const reorderedItems = Array.from(enginesContainerForRestore.querySelectorAll('.dropdown-item')).filter(
                    el => el.querySelector('.dropdown-engine-label')
                );
                const match = reorderedItems.find(item => getEngineLabel(item) === savedEngine);
                if (match) {
                    applySelectedSearchSource(match);
                    setPinnedEngine(match);
                }
            } else {
                const pinnedItem = enginesContainerForRestore.querySelector('.dropdown-item-pinned');
                if (pinnedItem) applySelectedSearchSource(pinnedItem);
            }

            ensureDragHandles();

            const getEngineItemsForSort = () => Array.from(enginesContainerForRestore.children).filter(
                c => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
            );

            const sortSection = document.createElement('div');
            sortSection.className = 'engines-sort-section';
            sortSection.innerHTML = '<button type="button" class="engines-sort-alphabetically">Restore A-Z</button>';
            enginesContainerForRestore.appendChild(sortSection);

            const isEngineListAlphabetical = () => {
                const items = getEngineItemsForSort();
                const labels = items.map(i => getEngineLabel(i));
                const sorted = [...labels].sort((a, b) => a.localeCompare(b));
                return labels.length === sorted.length && labels.every((l, i) => l === sorted[i]);
            };

            const updateSortButtonVisibility = () => {
                sortSection.hidden = isEngineListAlphabetical();
            };

            sortSection.querySelector('.engines-sort-alphabetically').addEventListener('click', (e) => {
                e.stopPropagation();
                const items = getEngineItemsForSort();
                const sorted = [...items].sort((a, b) => getEngineLabel(a).localeCompare(getEngineLabel(b)));
                sorted.forEach(item => enginesContainerForRestore.insertBefore(item, sortSection));
                const order = sorted.map(item => getEngineLabel(item));
                if (order.length) localStorage.setItem(SEARCH_ENGINE_ORDER_KEY, JSON.stringify(order));
                updateSortButtonVisibility();
                updateKeyboardNumbers();
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const smooth = !document.body.classList.contains('reduced-motion');
                        enginesContainerForRestore.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
                    });
                });
            });

            updateSortButtonVisibility();
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

    // Handle gradient search border checkbox (default: on)
    const gradientSearchBorderCheckbox = document.querySelector('.gradient-search-border-checkbox');
    if (gradientSearchBorderCheckbox) {
        const saved = localStorage.getItem(GRADIENT_SEARCH_BORDER_ENABLED_KEY);
        if (saved === 'false') {
            gradientSearchBorderCheckbox.checked = false;
            document.body.classList.add('gradient-search-border-off');
        } else {
            gradientSearchBorderCheckbox.checked = true;
            document.body.classList.remove('gradient-search-border-off');
        }
        gradientSearchBorderCheckbox.addEventListener('change', (e) => {
            const off = !e.target.checked;
            if (e.target.checked) {
                document.body.classList.remove('gradient-search-border-off');
                localStorage.setItem(GRADIENT_SEARCH_BORDER_ENABLED_KEY, 'true');
            } else {
                document.body.classList.add('gradient-search-border-off');
                localStorage.setItem(GRADIENT_SEARCH_BORDER_ENABLED_KEY, 'false');
                // Stop gradient animation and remove injected style so solid border shows immediately
                if (gradientAnimationId) {
                    cancelAnimationFrame(gradientAnimationId);
                    gradientAnimationId = null;
                }
                const existingStyle = document.getElementById('gradient-animation-style');
                if (existingStyle) existingStyle.remove();
            }
            [document.querySelector('.addressbar-iframe'), document.querySelector('.standalone-search-box-iframe')]
                .filter(Boolean)
                .forEach(f => {
                    try {
                        f.contentWindow?.postMessage({ type: 'gradient-search-border-off', off }, '*');
                    } catch (_) {}
                });
        });
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
        pinDefaultCheckbox.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            if (enabled) {
                document.body.classList.add('pin-default-enabled');
                localStorage.setItem(PIN_DEFAULT_SEARCH_ENGINE_ENABLED_KEY, 'true');
            } else {
                document.body.classList.remove('pin-default-enabled');
                localStorage.setItem(PIN_DEFAULT_SEARCH_ENGINE_ENABLED_KEY, 'false');
            }
            [document.querySelector('.addressbar-iframe'), document.querySelector('.standalone-search-box-iframe')]
                .filter(Boolean)
                .forEach(f => {
                    try {
                        f.contentWindow?.postMessage({ type: 'pin-default', enabled }, '*');
                    } catch (_) {}
                });
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
        const hadPaleGrey = localStorage.getItem('pale_grey_background_enabled') === 'true';
        if (savedBg) {
            if (savedBg === 'gradient') {
                delete document.body.dataset.background;
            } else {
                document.body.dataset.background = savedBg;
            }
        } else if (hadPaleGrey) {
            document.body.dataset.background = 'grey';
            localStorage.setItem(BACKGROUND_SWATCH_KEY, 'grey');
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

    // Calculate and set border radius based on wrapper height
    const updateBorderRadius = () => {
        console.log('[BORDER-RADIUS] Calculating border radiuses...');
        
        if (searchBoxWrapper && searchBoxWrapperOuter) {
            const wrapperHeight = searchBoxWrapper.offsetHeight;
            const borderRadius = wrapperHeight / 2;
            const gradientBorderRadius = borderRadius + 2;

            searchBoxWrapper.style.borderRadius = `${borderRadius}px`;
            searchBoxWrapperOuter.style.borderRadius = `${borderRadius}px`;
            document.documentElement.style.setProperty('--search-box-wrapper-radius', `${borderRadius}px`);

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
            suggestionsToShow = suggestions;
        } else if (searchValueTrimmed) {
            suggestionsToShow = [searchValueTrimmed, ...(Array.isArray(suggestions) ? suggestions : []).filter(s => {
                if (typeof s === 'object' && s._localSource) return false;
                return (typeof s === 'string' ? s : '').toLowerCase() !== searchValueTrimmed.toLowerCase();
            })];
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
                        hintText.dataset.searchHint = 'Search in ' + suggestion;
                    } else if (!isVisitSite) {
                        hintText.dataset.searchHint = 'Search with ' + getCurrentSearchEngineLabel();
                    }
                    li.appendChild(separator);
                    li.appendChild(hintText);
                }
                
                // Add click handler
                li.addEventListener('click', () => {
                    if (isLocalSource) {
                        const dropdown = searchSwitcherButton?.querySelector('.search-switcher-dropdown');
                        const item = dropdown ? Array.from(dropdown.querySelectorAll('.dropdown-item')).find(el => el.textContent.trim() === suggestion) : null;
                        if (item) {
                            applySelectedSearchSource(item);
                            if (searchInput) {
                                searchInput.value = '';
                                suggestionsList?.classList.add('suggestions-suppress-until-typed');
                                updateSuggestions([]);
                                searchInput.focus();
                            }
                        }
                    } else if (isVisitSite && looksLikeUrl(suggestion)) {
                        const url = suggestion.trim();
                        const toOpen = /^https?:\/\//i.test(url) ? url : 'https://' + url;
                        window.open(toOpen, '_blank');
                    } else {
                        console.log('[CLICK] Suggestion clicked:', suggestion);
                        saveToSearchHistory(suggestion);
                    }
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

            // Handle @ query - show only local sources (Bookmarks, Tabs, History, Actions)
            if (valueLower.startsWith('@')) {
                const afterAt = valueLower.slice(1).trim();
                const localSources = [
                    { _localSource: true, label: 'Bookmarks', icon: 'icons/star.svg' },
                    { _localSource: true, label: 'Tabs', icon: 'icons/tabs.svg' },
                    { _localSource: true, label: 'History', icon: 'icons/history.svg' },
                    { _localSource: true, label: 'Actions', icon: 'icons/actions.svg' }
                ];
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
    
    // Animate gradient border (skipped when gradient-search-border-off or reduced-motion)
    const animateGradient = () => {
        if (document.body.classList.contains('gradient-search-border-off') || document.body.classList.contains('reduced-motion')) {
            gradientAnimationId = null;
            const existingStyle = document.getElementById('gradient-animation-style');
            if (existingStyle) existingStyle.remove();
            return;
        }
        gradientAngle = (gradientAngle + 1) % 360;
        
        let style = document.getElementById('gradient-animation-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'gradient-animation-style';
        }
        style.textContent = `.search-box-wrapper-outer:has(.search-input:focus)::before { background: conic-gradient(from ${gradientAngle}deg, #FF00FF 0%, #FFA500 35%, #FFFFFF 50%, #FFA500 65%, #FF00FF 100%); }`;
        if (!document.head.contains(style)) {
            document.head.appendChild(style);
        }
        gradientAnimationId = requestAnimationFrame(animateGradient);
    };
    
    if (searchInput && searchContainer) {
        searchInput.addEventListener('focus', () => {
            logPanelState('INPUT FOCUS handler');
            if (restoringFocusFromSwitcher) {
                logPanelState('INPUT FOCUS restoringFromSwitcher path');
                restoringFocusFromSwitcher = false;
                searchContainer.classList.add('focused');
                if (suggestionsList) suggestionsList.classList.add('suggestions-revealed');
                requestAnimationFrame(() => {
                    logPanelState('INPUT FOCUS after rAF (state updated)');
                    requestAnimationFrame(() => updateLogoPositionForSearchBar({ skipWhenLogoOnLeft: true }));
                });
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
        });
        
        searchInput.addEventListener('blur', () => {
            logPanelState('INPUT BLUR handler');
            if (inspectSuggestions) return;
            if (searchSwitcherButton?.classList.contains('open')) {
                logPanelState('INPUT BLUR (switcher open, skipping close)');
                return;
            }
            closeSuggestionsPanel();
        });

        if (suggestionsList) {
            suggestionsList.addEventListener('transitionend', (e) => {
                logPanelState(`SUGGESTIONS transitionend property=${e.propertyName}`);
            });
        }
        
        // Track first hover
        suggestionItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                if (!firstHoverDone && suggestionsList.classList.contains('first-hover-fade')) {
                    firstHoverDone = true;
                    suggestionsList.classList.remove('first-hover-fade');
                }
            }, { once: false });
        });

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
                logPanelState('SWITCHER CLOSING (ESC)');
                searchSwitcherButton.classList.remove('switcher-opened-by-keyboard');
                searchSwitcherButton.querySelector('.search-switcher-dropdown')?.classList.remove('dropdown-revealed');
                searchSwitcherButton.classList.remove('open', 'switcher-suppress-hover');
                if (searchContainer?.classList.contains('focused')) {
                    closeSuggestionsPanel();
                } else {
                    restoreFocusAndOpaqueSuggestions();
                }
                logPanelState('SWITCHER CLOSED (ESC)');
                return;
            }
            if (searchInput && document.activeElement === searchInput) {
                searchInput.blur();
            }
        }
        const switcherOpen = searchSwitcherButton?.classList.contains('open');
        const switcherKeyboardMode = searchSwitcherButton?.classList.contains('switcher-opened-by-keyboard');
        if (switcherOpen && !event.altKey) {
            if (switcherKeyboardMode && /^[1-9]$/.test(event.key)) {
                const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
                const engineItems = enginesContainer ? Array.from(enginesContainer.children).filter(
                    c => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
                ) : [];
                const index = parseInt(event.key, 10) - 1;
                if (index >= 0 && index < engineItems.length) {
                    event.preventDefault();
                    const item = engineItems[index];
                    applySelectedSearchSource(item);
                    searchSwitcherButton.querySelector('.search-switcher-dropdown')?.classList.remove('dropdown-revealed');
                    searchSwitcherButton.classList.remove('open', 'switcher-suppress-hover', 'switcher-opened-by-keyboard');
                    switcherHighlightedIndex = -1;
                    searchSwitcherButton.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('highlighted'));
                    if (searchContainer?.classList.contains('focused')) {
                        restoreFocusAndOpaqueSuggestions();
                    } else {
                        searchInput?.focus();
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
                if (item.id !== 'quick-buttons-toggle' && !item.textContent.includes('Search Settings')) {
                    console.log('[SWITCHER KEYBOARD] Enter pressed on highlighted item, applying selection and closing');
                    applySelectedSearchSource(item);
                    dropdown?.classList.remove('dropdown-revealed');
                    searchSwitcherButton.classList.remove('open', 'switcher-suppress-hover');
                    switcherHighlightedIndex = -1;
                    logPanelState('SWITCHER CLOSING (keyboard num)');
                    dropdownItems.forEach(i => i.classList.remove('highlighted'));
                    if (searchContainer?.classList.contains('focused')) {
                        restoreFocusAndOpaqueSuggestions();
                    } else {
                        searchInput?.focus();
                    }
                    logPanelState('SWITCHER CLOSED (keyboard num)');
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

    // Keyboard navigation (ArrowUp, ArrowDown, Enter); Alt+ArrowUp/Down opens search engine switcher
    if (searchInput && suggestionsList) {
        searchInput.addEventListener('keydown', (event) => {
            const dropdown = searchSwitcherButton?.querySelector('.search-switcher-dropdown');
            const dropdownItems = dropdown ? Array.from(dropdown.querySelectorAll('.dropdown-item')) : [];
            
            if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
                event.preventDefault();
                if (searchSwitcherButton) {
                    searchSwitcherButton.classList.add('open', 'switcher-suppress-hover', 'switcher-opened-by-keyboard');
                    const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
                    if (enginesContainer) enginesContainer.scrollTo({ top: 0, behavior: 'instant' });
                    const firefoxSuggestionsContainer = searchSwitcherButton?.querySelector('.dropdown-firefox-suggestions');
                    if (firefoxSuggestionsContainer) firefoxSuggestionsContainer.scrollTo({ top: 0, behavior: 'instant' });
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
                    const searchText = searchInput.value.trim();
                    if (searchText) {
                        saveToSearchHistory(searchText);
                        window.open('https://www.google.com/search?q=' + encodeURIComponent(searchText), '_blank');
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
            console.log('[FOCUS] Search input focused, isRestoring:', isRestoringFocus);
            console.log('[FOCUS] Suggestions panel will show');
            
            if (isRestoringFocus) {
                console.log('[FOCUS] This is a restore focus - keeping transitions suppressed');
                // Don't add focused class, it's already there
                isRestoringFocus = false;
            }
            
            // Start gradient animation (unless reduced motion or gradient border is off)
            if (!gradientAnimationId && !document.body.classList.contains('reduced-motion') && !document.body.classList.contains('gradient-search-border-off')) {
                animateGradient();
            }
        });
        
        searchInput.addEventListener('blur', () => {
            console.log('[BLUR] Search input blurred');
            console.log('[BLUR] Suggestions panel will hide');
            if (searchSwitcherButton?.classList.contains('open')) {
                wasFocusedBeforeBlur = false;
            } else {
                wasFocusedBeforeBlur = searchContainer.classList.contains('focused');
            }
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
                wasSwitcherFocusedBeforeBlur = false;
                console.log('[WINDOW BLUR] Search was focused, remembering state');
            } else if (searchSwitcherButton && searchSwitcherButton.contains(document.activeElement)) {
                wasSwitcherFocusedBeforeBlur = true;
                wasFocusedBeforeBlur = false;
                console.log('[WINDOW BLUR] Switcher was focused, remembering state');
            }
        });
        
        window.addEventListener('focus', () => {
            console.log('[WINDOW FOCUS] Window gained focus, was focused before?', wasFocusedBeforeBlur, 'was switcher?', wasSwitcherFocusedBeforeBlur);
            
            if (wasSwitcherFocusedBeforeBlur && searchSwitcherButton?.classList.contains('open')) {
                console.log('[WINDOW FOCUS] Restoring focus to switcher');
                searchSwitcherButton.focus();
                wasSwitcherFocusedBeforeBlur = false;
            } else if (wasFocusedBeforeBlur) {
                console.log('[WINDOW FOCUS] Suppressing transitions and restoring focus to search');
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
