// Step 1 JavaScript

/** Set to true to enable verbose `[default-badge]` logs (insert badge, abort reasons, etc.) */
const DEBUG_DEFAULT_BADGE = false;
/** Set to false to silence badge drag logs (mousedown, drag move/end, applied default). On by default. */
const DEBUG_DEFAULT_BADGE_DRAG = true;
/** Logs when `elementsFromPoint` would hit a clone row before the chip list during default-badge drag (primary-only hit-test suppresses clone highlight). */
const DEBUG_DEFAULT_BADGE_CLONE_HIGHLIGHT = true;
/** Logs when the pointer stack hits a clone engine row during badge drag (same hit-test CSS :hover uses; not logged elsewhere). */
const DEBUG_DEFAULT_BADGE_CLONE_HOVER = true;

/** Inline detail for console (avoids expandable Object / Array in DevTools). */
function formatInlineLogDetail(detail) {
    if (detail === undefined) return '';
    if (detail === null) return ' null';
    const t = typeof detail;
    if (t === 'string' || t === 'number' || t === 'boolean') return ' ' + detail;
    if (detail instanceof Element) {
        const cls = String(detail.className || '')
            .replace(/\s+/g, ' ')
            .trim();
        return ` ${detail.tagName || '?'}${cls ? '.' + cls.slice(0, 120) : ''}`;
    }
    try {
        return ' ' + JSON.stringify(detail);
    } catch (_) {
        return ' [...]';
    }
}

function defaultBadgeLog(msg, detail) {
    if (!DEBUG_DEFAULT_BADGE) return;
    console.log('[default-badge] ' + msg + formatInlineLogDetail(detail));
}
function defaultBadgeDragLog(msg, detail) {
    if (!DEBUG_DEFAULT_BADGE_DRAG) return;
    console.log('[default-badge] ' + msg + formatInlineLogDetail(detail));
}
function defaultBadgeCloneHighlightLog(msg, detail) {
    if (!DEBUG_DEFAULT_BADGE_CLONE_HIGHLIGHT) return;
    console.log('[default-badge clone-highlight] ' + msg + formatInlineLogDetail(detail));
}
function defaultBadgeCloneHoverLog(msg, detail) {
    if (!DEBUG_DEFAULT_BADGE_CLONE_HOVER) return;
    console.log('[default-badge clone-hover] ' + msg + formatInlineLogDetail(detail));
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

/** Same authority as default-engine keys: prefer `top.localStorage` in embedded pages when allowed. */
function getSearchEngineOrderStorage() {
    return getDefaultSearchEngineLocalStorage();
}

/** Main New Tab / Homepage: when `false`, hide “From Firefox” in that switcher (Search settings → Navigate). */
const SEARCH_SETTINGS_NAVIGATE_NEW_TAB_KEY = 'search_settings_navigate_new_tab';
const SEARCH_SETTINGS_NAVIGATE_PRIVATE_KEY = 'search_settings_navigate_private';
/** Address bar row: when `'false'`, Search column is off (placeholder omits “Search with …”). */
const SEARCH_SETTINGS_SEARCH_ADDRESS_BAR_KEY = 'search_settings_search_address_bar';
/** Chip icon when Address bar is Navigate-only (Search off) in Search settings. */
const ADDRESSBAR_NAVIGATE_ONLY_SWITCHER_ICON_SRC = 'icons/globe.svg';
const ADDRESSBAR_SWITCHER_LABEL_DEFAULT = 'Search with';
const ADDRESSBAR_SWITCHER_LABEL_NAVIGATE_ONLY = 'Include suggestions from';

const SEARCH_ACCESS_POINT_SETTING_KEYS = [
    SEARCH_SETTINGS_NAVIGATE_NEW_TAB_KEY,
    SEARCH_SETTINGS_NAVIGATE_PRIVATE_KEY,
    SEARCH_SETTINGS_SEARCH_ADDRESS_BAR_KEY,
];

/** Parent `localStorage` snapshot for iframe mirror (opaque iframes may not share storage with top). */
function getSearchAccessPointSettingsKeysForMirror() {
    const out = {};
    try {
        const ls = localStorage;
        for (const k of SEARCH_ACCESS_POINT_SETTING_KEYS) {
            const v = ls.getItem(k);
            out[k] = v === null ? null : String(v);
        }
    } catch (_) {}
    return out;
}

function isNavigateEnabledForCurrentSwitcherSurface() {
    if (typeof document === 'undefined' || !document.body) return true;
    if (document.body.classList.contains('standalone-search-box')) return false;
    if (document.body.classList.contains('addressbar')) return true;
    try {
        return getDefaultSearchEngineLocalStorage().getItem(SEARCH_SETTINGS_NAVIGATE_NEW_TAB_KEY) === 'true';
    } catch (_) {
        return false;
    }
}

function applySwitcherFromFirefoxSectionVisibility() {
    const footer = document.querySelector('.search-switcher-button .dropdown-from-firefox-footer');
    if (!footer) return;
    const enabled = isNavigateEnabledForCurrentSwitcherSurface();
    footer.hidden = !enabled;
    footer.setAttribute('aria-hidden', enabled ? 'false' : 'true');
    document.body.classList.toggle('search-switcher-from-firefox-hidden', !enabled);
    if (typeof window !== 'undefined' && window !== window.top) {
        requestAnimationFrame(() => {
            try {
                window.dispatchEvent(new Event('resize'));
            } catch (_) {}
        });
    }
}

function isSearchEnabledForAccessPoint(surface) {
    if (surface === 'address-bar') {
        try {
            return getDefaultSearchEngineLocalStorage().getItem(SEARCH_SETTINGS_SEARCH_ADDRESS_BAR_KEY) !== 'false';
        } catch (_) {
            return true;
        }
    }
    return true;
}

/** Address bar iframe: Search off → “Include suggestions from”, hide web-search list + “From Firefox” heading; show local rows only. */
function applyAddressBarNavigateOnlySwitcherChrome() {
    if (typeof document === 'undefined' || !document.body) return;
    if (!document.body.classList.contains('addressbar') || document.body.classList.contains('standalone-search-box')) {
        document.body.classList.remove('addressbar-navigate-only-menu');
        return;
    }
    const navigateOnly = !isSearchEnabledForAccessPoint('address-bar');
    document.querySelectorAll('.search-switcher-button .dropdown-label-text').forEach((labelEl) => {
        labelEl.textContent = navigateOnly ? ADDRESSBAR_SWITCHER_LABEL_NAVIGATE_ONLY : ADDRESSBAR_SWITCHER_LABEL_DEFAULT;
    });
    document.body.classList.toggle('addressbar-navigate-only-menu', navigateOnly);
}

function isNavigateEnabledForAccessPoint(surface) {
    const ls = getDefaultSearchEngineLocalStorage();
    if (surface === 'address-bar') return true;
    if (surface === 'standalone') return false;
    if (surface === 'new-tab') {
        try {
            return ls.getItem(SEARCH_SETTINGS_NAVIGATE_NEW_TAB_KEY) === 'true';
        } catch (_) {
            return false;
        }
    }
    if (surface === 'private') {
        try {
            return ls.getItem(SEARCH_SETTINGS_NAVIGATE_PRIVATE_KEY) === 'true';
        } catch (_) {
            return false;
        }
    }
    return false;
}

/**
 * @param {'address-bar'|'new-tab'|'standalone'|'private'} surface
 * @param {string} engineLabel
 */
function buildAccessPointPlaceholderText(surface, engineLabel) {
    const label = String(engineLabel || 'Google').trim() || 'Google';
    const searchOn = isSearchEnabledForAccessPoint(surface);
    const navigateOn = isNavigateEnabledForAccessPoint(surface);
    const localSources = ['Bookmarks', 'History', 'Tabs', 'Actions'];
    const prep = localSources.includes(label) ? 'in' : 'with';

    if (searchOn && navigateOn) {
        return `Search ${prep} ${label} or enter web address`;
    }
    if (searchOn && !navigateOn) {
        return `Search ${prep} ${label}`;
    }
    if (!searchOn && navigateOn) {
        return 'Enter web address';
    }
    return '';
}

function getSearchAccessPointSurfaceForDocument() {
    if (typeof document === 'undefined' || !document.body) return 'new-tab';
    if (document.body.classList.contains('standalone-search-box')) return 'standalone';
    if (document.body.classList.contains('addressbar')) return 'address-bar';
    return 'new-tab';
}

/**
 * @param {string | null | undefined} selectedEngineLabel — from switcher row; falls back to stored default for this page
 */
function applySearchInputPlaceholderFromAccessPointSettings(selectedEngineLabel) {
    const input = document.querySelector('.search-input');
    if (!input) return;
    const surface = getSearchAccessPointSurfaceForDocument();
    const label =
        selectedEngineLabel != null && String(selectedEngineLabel).trim()
            ? String(selectedEngineLabel).trim()
            : getDefaultSearchEngineLabelFromStorage();
    input.placeholder = buildAccessPointPlaceholderText(surface, label);
}

function syncSearchSettingsPlaceholderPreviewFields() {
    if (typeof document === 'undefined' || window !== window.top) return;
    const matrix = getEffectiveSearchDefaultsFromStorage();
    const snap = getSearchSettingsOverlaySelectSnapshot();
    const selPrivate = document.getElementById('search-settings-default-engine-private');
    const privateEngine = (selPrivate && selPrivate.value) || matrix.newTab;

    const rows = [
        { id: 'search-settings-placeholder-preview-address-bar', surface: 'address-bar', engine: snap?.addressBar ?? matrix.addressBar },
        { id: 'search-settings-placeholder-preview-new-tab', surface: 'new-tab', engine: snap?.newTab ?? matrix.newTab },
        { id: 'search-settings-placeholder-preview-standalone', surface: 'standalone', engine: snap?.standalone ?? matrix.standalone },
        { id: 'search-settings-placeholder-preview-private', surface: 'private', engine: privateEngine },
    ];
    for (const { id, surface, engine } of rows) {
        const el = document.getElementById(id);
        if (el) el.value = buildAccessPointPlaceholderText(surface, engine);
    }
}

function broadcastSearchAccessPointPlaceholderRefresh() {
    if (typeof document === 'undefined' || window !== window.top) return;
    try {
        applySearchInputPlaceholderFromAccessPointSettings(null);
    } catch (_) {}
    const keys = getSearchAccessPointSettingsKeysForMirror();
    const iframes = [
        document.querySelector('.addressbar-iframe'),
        document.querySelector('.standalone-search-box-iframe'),
    ].filter(Boolean);
    for (const f of iframes) {
        try {
            f.contentWindow?.postMessage({ type: 'refresh-search-access-point-placeholder', keys }, '*');
        } catch (_) {}
    }
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
        populateSearchSettingsEngineSelectOptions();
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
 * Switcher open always logs via `logSearchSwitcherOpenedDefault()` (single-line string; no collapsed objects).
 * Extra dump: `localStorage.setItem('debug_search_engine_default_sync', 'true')` then reload.
 */
function getPinnedEngineLabelFromSwitcherButton(buttonEl) {
    if (!buttonEl) return null;
    const pinned = buttonEl.querySelector('.dropdown-search-engines .dropdown-item-pinned');
    const labelEl = pinned?.querySelector('.dropdown-engine-label');
    const t = labelEl?.textContent?.trim();
    return t || null;
}

/**
 * Visible engine rows in the switcher list (top to bottom). Same DOM rules as reorder / A–Z checks.
 * Top-level so logs do not depend on inner `getEngineLabel`.
 */
function getSearchEngineListOrderFromSwitcherButton(buttonEl) {
    if (!buttonEl) return [];
    const enginesContainer = buttonEl.querySelector('.dropdown-search-engines');
    if (!enginesContainer) return [];
    const items = Array.from(enginesContainer.children).filter(
        (c) => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
    );
    return items
        .map((item) => {
            const labelEl = item.querySelector('.dropdown-engine-label');
            return labelEl ? labelEl.textContent.trim() : '';
        })
        .filter(Boolean);
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

/**
 * Logs when the **chip** search switcher opens (user toggles the engine button so the dropdown mounts/opens).
 * Does **not** run when you only hover or toggle the ••• toolbar (primary or pinned clone). Not gated by localStorage.
 */
function logSearchSwitcherOpenedDefault(searchSwitcherButton) {
    const input = getDefaultSearchEngineSurfaceLabel();
    const key = getDefaultSearchEngineStorageKeyForPage();
    const pinnedLabel = getPinnedEngineLabelFromSwitcherButton(searchSwitcherButton);
    const storageLabel = getDefaultSearchEngineLabelFromStorage();
    const engineListOrder = getSearchEngineListOrderFromSwitcherButton(searchSwitcherButton);
    console.log(
        '[search-switcher] opened | input=' +
            input +
            ' | engineListOrder=' +
            JSON.stringify(engineListOrder) +
            ' | localStorageKey=' +
            key +
            ' | pinnedRowDefault=' +
            (pinnedLabel ?? '(none)') +
            ' | storageBackedDefault=' +
            storageLabel
    );
    if (pinnedLabel != null && storageLabel != null && pinnedLabel !== storageLabel) {
        console.warn(
            '[search-switcher] pinned row ≠ storage-backed default | input=' +
                input +
                ' | pinnedRowDefault=' +
                pinnedLabel +
                ' | storageBackedDefault=' +
                storageLabel
        );
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
const SEARCH_SWITCHER_CONTROLS_VISIBLE_BY_DEFAULT_KEY = 'search_switcher_controls_visible_by_default';
const STANDALONE_SEARCH_BOX_VISIBLE_KEY = 'standalone_search_box_visible';
const PROTOTYPE_BROWSER_CHROME_VISIBLE_KEY = 'prototype_browser_chrome_visible';

/** Main page only: keep `?content=0` in sync when toggling the mock below the hero (prototype panel). */
function syncPrototypeNewTabContentUrlParam(show) {
    if (typeof window === 'undefined' || window !== window.top) return;
    try {
        const url = new URL(window.location.href);
        if (show) {
            url.searchParams.delete('content');
        } else {
            url.searchParams.set('content', '0');
        }
        history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (_) {}
}

/** Main page only: `?chrome=0` / `chrome=false` (see step1.html) ↔ “Show browser chrome” off. */
function syncPrototypeBrowserChromeUrlParam(showChrome) {
    if (typeof window === 'undefined' || window !== window.top) return;
    try {
        const url = new URL(window.location.href);
        if (showChrome) {
            url.searchParams.delete('chrome');
        } else {
            url.searchParams.set('chrome', '0');
        }
        history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (_) {}
}

/** Main top document only: `?newtab=pin` seeds pinned-right list mode (see search-engine-list-mode init). */
function syncSearchEngineListModeNewtabUrlParam(mode) {
    if (typeof window === 'undefined' || window !== window.top) return;
    if (typeof document !== 'undefined' && document.body?.classList.contains('addressbar')) return;
    try {
        const url = new URL(window.location.href);
        if (mode === 'pinned-right') {
            url.searchParams.set('newtab', 'pin');
        } else {
            url.searchParams.delete('newtab');
        }
        history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (_) {}
}

/** Main page only: `?settings=1` opens Search settings on load; keep the bar in sync when opening/closing the modal. */
function syncSearchSettingsModalUrlParam(open) {
    if (typeof window === 'undefined' || window !== window.top) return;
    try {
        const url = new URL(window.location.href);
        if (open) {
            url.searchParams.set('settings', '1');
        } else {
            url.searchParams.delete('settings');
        }
        history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (_) {}
}

function readStandaloneSearchBoxVisibleFromStorage() {
    try {
        return localStorage.getItem(STANDALONE_SEARCH_BOX_VISIBLE_KEY) === 'true';
    } catch (_) {
        return false;
    }
}

/**
 * Same-origin only: toggle `.standalone-search-field-hidden` on the iframe’s `.search-container` synchronously.
 * `postMessage` runs too late relative to `resize` (which narrows the iframe), which caused one frame of
 * “full search row squeezed into icons-only width” (pill/switcher over toolbar, icons shoved off-screen).
 */
function syncStandaloneSearchFieldHiddenInIframeDocument(standaloneIframe, visible) {
    if (!standaloneIframe) return false;
    try {
        const doc = standaloneIframe.contentDocument || standaloneIframe.contentWindow?.document;
        const c = doc?.querySelector('.search-container');
        if (!c) return false;
        if (visible) {
            c.classList.remove('standalone-search-field-hidden');
        } else {
            c.classList.add('standalone-search-field-hidden');
        }
        return true;
    } catch (_) {
        return false;
    }
}

/** Prototype: show/hide standalone search field inside its iframe (iframe + toolbar icons stay); persist + sync UI. */
function applyStandaloneSearchBoxPrototypeVisibility(visible) {
    const on = !!visible;
    try {
        localStorage.setItem(STANDALONE_SEARCH_BOX_VISIBLE_KEY, on ? 'true' : 'false');
    } catch (_) {}
    const toggle = typeof document !== 'undefined' ? document.getElementById('search-settings-standalone-visibility-toggle') : null;
    if (toggle) {
        toggle.setAttribute('aria-checked', on ? 'true' : 'false');
        toggle.classList.toggle('search-settings-standalone-visibility-toggle--on', on);
    }
    const standaloneIframe =
        typeof document !== 'undefined' && window === window.top
            ? document.querySelector('.standalone-search-box-iframe')
            : null;
    try {
        standaloneIframe?.classList.toggle('standalone-search-box-iframe--field-hidden', !on);
    } catch (_) {}

    let resized = false;
    try {
        if (typeof window !== 'undefined' && window === window.top && standaloneIframe) {
            let canSync = false;
            try {
                const doc = standaloneIframe.contentDocument || standaloneIframe.contentWindow?.document;
                canSync = !!doc?.querySelector('.search-container');
            } catch (_) {
                canSync = false;
            }
            if (on) {
                /* Show: widen first; reveal on the next frame so layout never runs “narrow + full search”. */
                window.dispatchEvent(new Event('resize'));
                resized = true;
                if (canSync) {
                    requestAnimationFrame(() => {
                        syncStandaloneSearchFieldHiddenInIframeDocument(standaloneIframe, true);
                    });
                }
            } else {
                /* Hide: display:none must commit before the parent narrows the iframe; same-turn resize still
                 * produced row=131 with search at 0×35 (flex squeeze) before paint. Defer narrow 2 rAFs. */
                if (canSync) {
                    syncStandaloneSearchFieldHiddenInIframeDocument(standaloneIframe, false);
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            try {
                                window.dispatchEvent(new Event('resize'));
                            } catch (_) {}
                        });
                    });
                } else {
                    /* No contentDocument: send hide first, then narrow on a later macrotask (not before message runs). */
                    try {
                        standaloneIframe.contentWindow?.postMessage(
                            { type: 'standalone-search-box-visible', visible: false },
                            '*'
                        );
                    } catch (_) {}
                    window.setTimeout(() => {
                        try {
                            window.dispatchEvent(new Event('resize'));
                        } catch (_) {}
                    }, 0);
                }
                resized = true;
            }
        }
    } catch (_) {}
    try {
        if (typeof window !== 'undefined' && window === window.top && !resized) {
            window.dispatchEvent(new Event('resize'));
        }
    } catch (_) {}

    try {
        /* Duplicate post for !canSync hide is harmless; keeps height sync and other listeners consistent. */
        standaloneIframe?.contentWindow?.postMessage({ type: 'standalone-search-box-visible', visible: on }, '*');
    } catch (_) {}
}

const BACKGROUND_SWATCH_KEY = 'background_swatch';
/** Default when no stored preference (matches step1.html swatches + reset prototype). */
const DEFAULT_BACKGROUND_SWATCH = 'blue';
const MAIN_SCREEN_HERO_LOGO_MODE_KEY = 'main_screen_hero_logo_mode';
/** Main-page strapline (“Start your Google search…”) dismissed via the attached close control. */
const MAIN_SCREEN_BRAND_STRAPLINE_DISMISSED_KEY = 'main_screen_brand_strapline_dismissed';
/** Bordered strapline bar + close control (prototype); off = legacy flat strapline without border. */
const DISMISSABLE_STRAPLINE_ENABLED_KEY = 'dismissable_strapline_enabled';
/** `'search_engine'` = dynamic horizontal wordmarks; `'firefox'` = Firefox icon only (classic hero). */
const DEFAULT_MAIN_SCREEN_HERO_LOGO_MODE = 'search_engine';

function getMainScreenHeroLogoMode() {
    try {
        return localStorage.getItem(MAIN_SCREEN_HERO_LOGO_MODE_KEY) === 'firefox' ? 'firefox' : 'search_engine';
    } catch (_) {
        return 'search_engine';
    }
}

function applyMainScreenHeroLogoMode(mode) {
    const isFirefox = mode === 'firefox';
    if (isFirefox) {
        document.body.dataset.mainScreenHeroLogo = 'firefox';
        try {
            delete document.body.dataset.mainScreenHeroEngineLabel;
        } catch (_) {}
    } else {
        delete document.body.dataset.mainScreenHeroLogo;
    }
}

function syncMainScreenHeroLogoRadiosToMode(mode) {
    document
        .querySelectorAll('input[name="main-screen-hero-logo"], input[name="main-screen-hero-logo-settings"]')
        .forEach((radio) => {
            radio.checked = radio.value === mode;
        });
}
const SEARCH_BORDER_COLOR_KEY = 'search_border_color';
/** `'small'` = CSS fallbacks; `'large'` = JS measures elements and fully rounds corners. */
const SEARCH_BORDER_RADIUS_MODE_KEY = 'search_border_radius_mode';
const SEARCH_BORDER_COLOR_DEFAULT = '#BBA0FF';
const SEARCH_BORDER_CORAL = '#FF8D5B';
const SEARCH_BORDER_BLACK_20 = 'rgba(0, 0, 0, 0.2)';
const SEARCH_BORDER_COLORS = [SEARCH_BORDER_COLOR_DEFAULT, SEARCH_BORDER_CORAL, SEARCH_BORDER_BLACK_20];

/** Prototype background swatch (`data-background`) → default search focus ring colour. */
function defaultSearchBorderColorForBackgroundSwatch(bg) {
    if (bg === 'gradient' || bg === 'grey') return SEARCH_BORDER_BLACK_20;
    if (bg === 'beige') return SEARCH_BORDER_CORAL;
    return SEARCH_BORDER_COLOR_DEFAULT;
}

function getCurrentBackgroundSwatchFromStorage() {
    try {
        const v = localStorage.getItem(BACKGROUND_SWATCH_KEY);
        if (v === 'gradient') return 'gradient';
        if (v === 'grey' || v === 'blue' || v === 'beige') return v;
    } catch (_) {}
    return DEFAULT_BACKGROUND_SWATCH;
}

/** Persist ring colour, update swatch UI, notify iframes (shared by border swatches and background pairing). */
function persistSearchBorderColorForPrototype(rawColor) {
    const c = canonicalSearchBorderColor(rawColor);
    try {
        localStorage.setItem(SEARCH_BORDER_COLOR_KEY, c);
    } catch (_) {}
    applySearchBorderColorVariable(c);
    document.querySelectorAll('.search-border-swatch').forEach((btn) => {
        const bn = normalizeSearchBorderColorInput(btn.dataset.borderColor);
        btn.setAttribute('aria-pressed', bn === c ? 'true' : 'false');
    });
    [document.querySelector('.addressbar-iframe'), document.querySelector('.standalone-search-box-iframe')]
        .filter(Boolean)
        .forEach((f) => {
            try {
                f.contentWindow?.postMessage({ type: 'search-border-color', color: c }, '*');
            } catch (_) {}
        });
    return c;
}

/** Order matches prototype Visuals swatches (left → right). */
const PROTOTYPE_BACKGROUND_SWATCH_ORDER = ['gradient', 'grey', 'blue', 'beige'];

function normalizePrototypeBackgroundKey(raw) {
    if (raw === 'gradient') return 'gradient';
    if (raw === 'grey' || raw === 'blue' || raw === 'beige') return raw;
    return null;
}

function getCurrentPrototypeBackgroundKey() {
    try {
        return normalizePrototypeBackgroundKey(localStorage.getItem(BACKGROUND_SWATCH_KEY)) || DEFAULT_BACKGROUND_SWATCH;
    } catch (_) {
        return DEFAULT_BACKGROUND_SWATCH;
    }
}

function applyPrototypeBackgroundSwatch(bg) {
    if (!PROTOTYPE_BACKGROUND_SWATCH_ORDER.includes(bg)) return;
    try {
        localStorage.setItem(BACKGROUND_SWATCH_KEY, bg);
    } catch (_) {}
    if (bg === 'gradient') {
        delete document.body.dataset.background;
    } else {
        document.body.dataset.background = bg;
    }
    const current = document.body.dataset.background || 'gradient';
    document.querySelectorAll('.background-swatch').forEach((btn) => {
        btn.setAttribute('aria-pressed', btn.dataset.background === current ? 'true' : 'false');
    });
    persistSearchBorderColorForPrototype(defaultSearchBorderColorForBackgroundSwatch(bg));
    try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new Event('prototype-background-swatch-changed'));
        }
    } catch (_) {}
}

function cyclePrototypeBackgroundSwatch() {
    const cur = getCurrentPrototypeBackgroundKey();
    const i = PROTOTYPE_BACKGROUND_SWATCH_ORDER.indexOf(cur);
    const idx = i >= 0 ? i : 0;
    const nextBg = PROTOTYPE_BACKGROUND_SWATCH_ORDER[(idx + 1) % PROTOTYPE_BACKGROUND_SWATCH_ORDER.length];
    applyPrototypeBackgroundSwatch(nextBg);
}

/** Matches `step1.html` default order (Google remains `.dropdown-item-pinned`). */
const DEFAULT_MAIN_PAGE_ENGINE_ORDER = [
    'Amazon', 'Bing', 'DuckDuckGo', 'eBay', 'Ecosia', 'Google',
    'IMDb', 'Perplexity', 'Reddit', 'Startpage', 'Wikipedia (en)', 'YouTube'
];

/** Case-insensitive A–Z (so eBay sorts before Ecosia; matches “Reset A-Z” / is-alphabetical checks). */
function compareEngineLabelsAlphabetically(a, b) {
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function getDropdownEngineLabelFromItem(item) {
    if (!item) return '';
    const labelEl = item.querySelector('.dropdown-engine-label');
    return labelEl ? labelEl.textContent.trim() : '';
}

function setEnginesSortSectionHiddenIfAlphabetical(enginesContainer, sortSectionEl) {
    if (!enginesContainer || !sortSectionEl) return;
    const items = Array.from(enginesContainer.children).filter(
        (c) => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
    );
    const labels = items.map((i) => getDropdownEngineLabelFromItem(i));
    const sorted = [...labels].sort(compareEngineLabelsAlphabetically);
    const isAlphabetical =
        labels.length === sorted.length && labels.every((l, i) => l === sorted[i]);
    const hasSortUi = sortSectionEl.childElementCount > 0;
    /* Anchor stays in DOM for drag insertBefore; hide when A–Z or when there is no sort control (empty padding was showing a gap). */
    sortSectionEl.hidden = isAlphabetical || !hasSortUi;
}

/**
 * Reorders `.dropdown-item` rows under `.dropdown-search-engines` to `DEFAULT_MAIN_PAGE_ENGINE_ORDER`,
 * inserting each before `sortSectionEl` when provided (so the sort anchor stays at the end).
 * Updates `sortSectionEl.hidden` when the list matches case-insensitive A–Z.
 */
function applyCanonicalSearchEngineOrder(enginesContainer, sortSectionEl) {
    if (!enginesContainer) return;
    const anchor = sortSectionEl || null;
    const byLabel = new Map();
    enginesContainer.querySelectorAll('.dropdown-item').forEach((item) => {
        const label = getDropdownEngineLabelFromItem(item);
        if (label) byLabel.set(label, item);
    });
    DEFAULT_MAIN_PAGE_ENGINE_ORDER.forEach((label) => {
        const el = byLabel.get(label);
        if (el) enginesContainer.insertBefore(el, anchor);
    });
    setEnginesSortSectionHiddenIfAlphabetical(enginesContainer, sortSectionEl);
}

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

function getSearchBorderRadiusMode() {
    try {
        const v = localStorage.getItem(SEARCH_BORDER_RADIUS_MODE_KEY);
        if (v === 'large' || v === 'small') return v;
        localStorage.setItem(SEARCH_BORDER_RADIUS_MODE_KEY, 'small');
        return 'small';
    } catch (_) {
        return 'small';
    }
}

function getStoredSearchBorderColor() {
    const raw = localStorage.getItem(SEARCH_BORDER_COLOR_KEY);
    const fromStorage = raw ? normalizeSearchBorderColorInput(raw) : null;
    if (fromStorage) return fromStorage;
    if (localStorage.getItem('gradient_search_border_enabled') === 'false') {
        return SEARCH_BORDER_BLACK_20;
    }
    return defaultSearchBorderColorForBackgroundSwatch(getCurrentBackgroundSwatchFromStorage());
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
const SEARCH_ENGINES_COUNT_KEY = 'search_engines_count';
const SWITCHER_OUTSIDE_SEARCH_BOX_ENABLED_KEY = 'switcher_outside_search_box_enabled';

/** Subset labels for 6-engine prototype mode (matches prior `twelve_search_engines_enabled === false`). */
const SEARCH_ENGINE_LABELS_6 = ['Google', 'Bing', 'DuckDuckGo', 'eBay', 'Perplexity', 'Wikipedia (en)'];
/** Full 12 labels in the default switcher markup. */
const SEARCH_ENGINE_LABELS_12 = [
    'Amazon',
    'Bing',
    'DuckDuckGo',
    'Ecosia',
    'eBay',
    'Google',
    'IMDb',
    'Perplexity',
    'Reddit',
    'Startpage',
    'Wikipedia (en)',
    'YouTube',
];

/**
 * Horizontal or wide wordmark SVGs for the main-screen hero (matches 6-engine prototype set + shared engines).
 * Sources: `icons/google-logo.svg` (Google brand wordmark), `icons/duckduckgo-logo.svg` (DDG site horizontal lockup),
 * Wikimedia Commons — Microsoft_Bing_logo.svg, EBay_logo.svg, Perplexity_AI_logo.svg; en.wikipedia.org static — wikipedia-wordmark-en.svg;
 */
/** Full-colour horizontal Google wordmark; grey wallpaper uses `icons/google-logo-grey-hero.svg` instead. */
const MAIN_SCREEN_GOOGLE_LOGO_HERO_SRC = 'icons/google-logo.svg';
const MAIN_SCREEN_GOOGLE_LOGO_GREY_HERO_SRC = 'icons/google-logo-grey-hero.svg';

function getMainScreenHeroGoogleWordmarkSrc() {
    try {
        if (typeof document !== 'undefined' && document.body?.dataset?.background === 'grey') {
            return MAIN_SCREEN_GOOGLE_LOGO_GREY_HERO_SRC;
        }
    } catch (_) {}
    return MAIN_SCREEN_GOOGLE_LOGO_HERO_SRC;
}

/** When assigning the hero `google-logo.svg` asset, swap to grey fills on grey wallpaper. */
function resolveMainScreenHeroGoogleWordmarkSrc(candidateSrc) {
    const c = String(candidateSrc || '');
    if (
        c === MAIN_SCREEN_GOOGLE_LOGO_HERO_SRC ||
        c.endsWith('/google-logo.svg') ||
        c.endsWith('google-logo.svg')
    ) {
        return getMainScreenHeroGoogleWordmarkSrc();
    }
    return candidateSrc;
}

const MAIN_SCREEN_HORIZONTAL_ENGINE_LOGOS = {
    Google: 'icons/google-logo.svg',
    Bing: 'icons/bing-logo-horizontal.svg',
    DuckDuckGo: 'icons/duckduckgo-logo.svg',
    eBay: 'icons/ebay-logo-horizontal.svg',
    Perplexity: 'icons/perplexity-logo-horizontal.svg',
    'Wikipedia (en)': 'icons/wikipedia-wordmark-en.svg',
};

function getStoredSearchEnginesCount() {
    try {
        /* Same authority as `getSearchEngineOrderStorage()` so embedded iframes stay in sync with the parent (order + count). */
        const ls = getDefaultSearchEngineLocalStorage();
        const raw = ls.getItem(SEARCH_ENGINES_COUNT_KEY);
        if (raw === '6' || raw === '12' || raw === '50') return parseInt(raw, 10);
        const legacy = ls.getItem(TWELVE_SEARCH_ENGINES_ENABLED_KEY);
        const fallback = legacy === 'true' ? 12 : 6;
        ls.setItem(SEARCH_ENGINES_COUNT_KEY, String(fallback));
        return fallback;
    } catch (_) {
        return 6;
    }
}

/**
 * 38 additional prototype rows beyond the default 12 — varied names and icons from `/icons`.
 * (Keeps 50 total = 12 + 38.)
 */
const PROTOTYPE_ENGINE_EXTRAS_38 = [
    { label: 'Spotify', icon: 'icons/Spotify.svg' },
    { label: 'Pinterest', icon: 'icons/Pinterest.svg' },
    { label: 'Facebook', icon: 'icons/Facebook.svg' },
    { label: 'Instagram', icon: 'icons/Instagram.svg' },
    { label: 'Yahoo', icon: 'icons/Yahoo.svg' },
    { label: 'Twitter', icon: 'icons/Twitter.svg' },
    { label: 'Telegram', icon: 'icons/Telegram.svg' },
    { label: 'Mozilla', icon: 'icons/Mozilla.svg' },
    { label: 'Firefox', icon: 'icons/Firefox.svg' },
    { label: 'Zoom', icon: 'icons/Zoom.svg' },
    { label: 'Slack', icon: 'icons/Slack.svg' },
    { label: 'Microsoft Teams', icon: 'icons/Microsoft Teams.svg' },
    { label: 'Messenger', icon: 'icons/Messenger.svg' },
    { label: 'TripAdvisor', icon: 'icons/TripAdvisor.svg' },
    { label: 'Yelp', icon: 'icons/Yelp.svg' },
    { label: 'Tasty', icon: 'icons/Tasty.svg' },
    { label: 'Pocket', icon: 'icons/Pocket.svg' },
    { label: 'Figma', icon: 'icons/Figma.svg' },
    { label: 'Airbnb', icon: 'icons/Airbnb.svg' },
    { label: 'AllTrails', icon: 'icons/AllTrails.svg' },
    { label: 'AllRecipes', icon: 'icons/AllRecipes.svg' },
    { label: 'CBC', icon: 'icons/CBC.svg' },
    { label: 'Google Mail', icon: 'icons/Google Mail.svg' },
    { label: 'Google Drive', icon: 'icons/Google Drive.svg' },
    { label: 'Google Docs', icon: 'icons/Google Docs.svg' },
    { label: 'ESPN', icon: 'icons/espn.svg' },
    { label: 'Olympics', icon: 'icons/olympics.svg' },
    /* Below: only brand / full-colour assets — avoid monochrome line-art used for browser chrome (globe, search, tabs, etc.). */
    { label: 'Amazon Fresh', icon: 'icons/Amazon - Light.svg' },
    { label: 'Bing Shopping', icon: 'icons/Bing.svg' },
    { label: 'DuckDuckGo Privacy', icon: 'icons/DuckDuckGo.svg' },
    { label: 'eBay Motors', icon: 'icons/ebay.svg' },
    { label: 'Ecosia Shop', icon: 'icons/Ecosia.svg' },
    { label: 'Google Lens', icon: 'icons/Google.svg' },
    { label: 'IMDb Movies', icon: 'icons/IMDb.svg' },
    { label: 'Perplexity Discover', icon: 'icons/Perplexity.svg' },
    { label: 'Reddit AMA', icon: 'icons/Reddit.svg' },
    { label: 'YouTube Shorts', icon: 'icons/YouTube.svg' },
    { label: 'Gmail', icon: 'icons/Gmail.svg' },
];

let prototypeExtraEngineIconByLabel = null;

function getPrototypeExtraEngineIcon(label) {
    if (!prototypeExtraEngineIconByLabel) {
        prototypeExtraEngineIconByLabel = new Map(PROTOTYPE_ENGINE_EXTRAS_38.map((e) => [e.label, e.icon]));
    }
    return prototypeExtraEngineIconByLabel.get(label) ?? null;
}

function getPrototypeEngineLabels50() {
    return [...SEARCH_ENGINE_LABELS_12, ...PROTOTYPE_ENGINE_EXTRAS_38.map((e) => e.label)];
}

function getSearchEngineLabelsForCountMode(count) {
    const c = Number(count);
    const normalized = c === 6 || c === 12 || c === 50 ? c : 12;
    if (normalized >= 50) return getPrototypeEngineLabels50();
    if (normalized >= 12) return [...SEARCH_ENGINE_LABELS_12];
    return [...SEARCH_ENGINE_LABELS_6];
}

/**
 * Prototype default **visible** row order for the engine-count mode (matches shipped HTML + `applyCanonicalSearchEngineOrder`,
 * and 6-mode: same relative order as 12-mode with non-allowed rows hidden — not `SEARCH_ENGINE_LABELS_6` alone).
 */
function getDefaultVisibleSearchEngineOrder(count) {
    const n = count === 6 || count === 12 || count === 50 ? count : 12;
    if (n >= 50) {
        const primary = new Set(DEFAULT_MAIN_PAGE_ENGINE_ORDER);
        const tail = getPrototypeEngineLabels50().filter((label) => !primary.has(label));
        return [...DEFAULT_MAIN_PAGE_ENGINE_ORDER, ...tail];
    }
    if (n >= 12) {
        return [...DEFAULT_MAIN_PAGE_ENGINE_ORDER];
    }
    const allowed = new Set(getSearchEngineLabelsForCountMode(6));
    return DEFAULT_MAIN_PAGE_ENGINE_ORDER.filter((label) => allowed.has(label));
}

/** Ensures enough `.dropdown-item` rows exist for 50-engine prototype mode (idempotent). */
function ensurePrototypeSearchEngineRows() {
    const enginesContainer = document.querySelector('.search-switcher-button .dropdown-search-engines');
    if (!enginesContainer) return;
    const sortSection = enginesContainer.querySelector('.engines-sort-section');
    const existing = new Set();
    enginesContainer.querySelectorAll('.dropdown-item').forEach((item) => {
        const l = getDropdownEngineLabelFromItem(item);
        if (l) existing.add(l);
    });
    const want50 = getPrototypeEngineLabels50();
    const template = enginesContainer.querySelector('.dropdown-item-search-engine');
    if (!template) return;
    for (const label of want50) {
        if (existing.has(label)) continue;
        const clone = template.cloneNode(true);
        clone.classList.remove('highlighted');
        const labelEl = clone.querySelector('.dropdown-engine-label');
        if (labelEl) labelEl.textContent = label;
        const img = clone.querySelector('.dropdown-engine-icon');
        if (img) {
            img.setAttribute('alt', label);
            const extraIcon = getPrototypeExtraEngineIcon(label);
            if (extraIcon) {
                img.setAttribute('src', extraIcon);
            }
        }
        if (sortSection) enginesContainer.insertBefore(clone, sortSection);
        else enginesContainer.appendChild(clone);
        existing.add(label);
    }
    try {
        scheduleListEngineLabelTooltipSync();
    } catch (_) {}
}

/** List view: show a native tooltip only when `.dropdown-engine-label` text is ellipsized. */
function updateListEngineLabelTruncationTooltips() {
    document
        .querySelectorAll(
            '.search-switcher-button .dropdown-search-engines .dropdown-engine-label, .search-switcher-pinned-right-host .dropdown-search-engines .dropdown-engine-label'
        )
        .forEach((el) => {
            const dd = el.closest('.search-switcher-dropdown');
            if (dd?.classList.contains('search-engines-display-grid')) {
                el.removeAttribute('title');
                return;
            }
            const text = (el.textContent || '').trim();
            if (!text) {
                el.removeAttribute('title');
                return;
            }
            const truncated = el.scrollWidth > el.clientWidth + 0.5;
            if (truncated) {
                el.setAttribute('title', text);
            } else {
                el.removeAttribute('title');
            }
        });
}

function scheduleListEngineLabelTooltipSync() {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => updateListEngineLabelTruncationTooltips());
    });
}

let lastSearchSettingsEngineSelectOptionsMode = null;

/** Rebuild Search settings overlay <option>s to match 6 / 12 / 50 engine mode (same lists as the switcher). */
function populateSearchSettingsEngineSelectOptions(count) {
    if (count === undefined) {
        try {
            count = getStoredSearchEnginesCount();
        } catch (_) {
            count = 12;
        }
    }
    if (lastSearchSettingsEngineSelectOptionsMode === count) return;
    lastSearchSettingsEngineSelectOptionsMode = count;
    const labels = getSearchEngineLabelsForCountMode(count);
    const ids = [
        'search-settings-default-engine-address-bar',
        'search-settings-default-engine-new-tab',
        'search-settings-default-engine-standalone',
        'search-settings-default-engine-private',
    ];
    for (const id of ids) {
        const sel = document.getElementById(id);
        if (!sel) continue;
        sel.innerHTML = '';
        for (const label of labels) {
            const opt = document.createElement('option');
            opt.value = label;
            opt.textContent = label;
            sel.appendChild(opt);
        }
    }
}
const SEARCH_ENGINE_LIST_MODE_KEY = 'search_engine_list_mode';
/** Address bar iframe only; keeps “pinned list” independent from New Tab (main page). */
const SEARCH_ENGINE_LIST_MODE_KEY_ADDRESSBAR = 'search_engine_list_mode:addressbar';

function isAddressBarSearchSurfaceDocument() {
    try {
        return (
            typeof document !== 'undefined' &&
            !!document.body &&
            document.body.classList.contains('addressbar') &&
            !document.body.classList.contains('standalone-search-box')
        );
    } catch (_) {
        return false;
    }
}

function getSearchEngineListModeStorageKey() {
    return isAddressBarSearchSurfaceDocument() ? SEARCH_ENGINE_LIST_MODE_KEY_ADDRESSBAR : SEARCH_ENGINE_LIST_MODE_KEY;
}

function getSearchEngineListMode() {
    try {
        const key = getSearchEngineListModeStorageKey();
        let raw = localStorage.getItem(key);
        if (key === SEARCH_ENGINE_LIST_MODE_KEY_ADDRESSBAR && (raw === null || raw === '')) {
            raw = localStorage.getItem(SEARCH_ENGINE_LIST_MODE_KEY);
        }
        if (raw === 'closed' || raw === 'pinned-left' || raw === 'pinned-right') return raw;
        if (key === SEARCH_ENGINE_LIST_MODE_KEY_ADDRESSBAR) {
            return 'closed';
        }
        localStorage.setItem(SEARCH_ENGINE_LIST_MODE_KEY, 'closed');
        return 'closed';
    } catch (_) {
        return 'closed';
    }
}

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
    const brandStraplineDismiss = document.querySelector('.main-screen-brand-dismiss');
    const brandStraplineRow = document.querySelector('.main-screen-brand-firefox-row');
    const dismissableStraplineOn = document.body.classList.contains('dismissable-strapline-enabled');
    if (brandStraplineRow) {
        if (dismissableStraplineOn) {
            try {
                if (localStorage.getItem(MAIN_SCREEN_BRAND_STRAPLINE_DISMISSED_KEY) === 'true') {
                    brandStraplineRow.hidden = true;
                }
            } catch (_) {}
        } else {
            brandStraplineRow.hidden = false;
        }
    }
    if (brandStraplineDismiss && brandStraplineRow) {
        brandStraplineDismiss.addEventListener('click', () => {
            if (!document.body.classList.contains('dismissable-strapline-enabled')) return;
            brandStraplineRow.hidden = true;
            try {
                localStorage.setItem(MAIN_SCREEN_BRAND_STRAPLINE_DISMISSED_KEY, 'true');
            } catch (_) {}
        });
    }

    let underlineSearchEnginesEnabled = localStorage.getItem(UNDERLINE_SEARCH_ENGINES_ENABLED_KEY) === 'true';
    const keyboardSwitcherNumbersEnabled = localStorage.getItem(KEYBOARD_SWITCHER_NUMBERS_ENABLED_KEY) !== 'false';
    document.body.classList.toggle('keyboard-switcher-numbers-enabled', keyboardSwitcherNumbersEnabled);
    const SEARCH_ENGINES_DISPLAY_SURFACE_PRIMARY = 'primary';
    const SEARCH_ENGINES_DISPLAY_SURFACE_PINNED = 'pinned-right';
    const getSearchEnginesDisplayKey = (surface = SEARCH_ENGINES_DISPLAY_SURFACE_PRIMARY) => {
        // Per-search-bar preference:
        // - main page search bar
        // - address bar iframe
        // - standalone search box iframe
        const isAddressbar = document.body.classList.contains('addressbar');
        const isStandalone = document.body.classList.contains('standalone-search-box');
        const scope = isAddressbar && isStandalone ? 'standalone' : (isAddressbar ? 'addressbar' : 'main');
        const base = `${SEARCH_ENGINES_DISPLAY_KEY_PREFIX}:${scope}`;
        return surface === SEARCH_ENGINES_DISPLAY_SURFACE_PINNED ? `${base}:pinnedRight` : base;
    };
    const getSearchEnginesDisplayModeForSurface = (surface = SEARCH_ENGINES_DISPLAY_SURFACE_PRIMARY) => {
        const key = getSearchEnginesDisplayKey(surface);
        let raw = null;
        try {
            raw = localStorage.getItem(key);
        } catch (_) {}
        if (surface === SEARCH_ENGINES_DISPLAY_SURFACE_PINNED && (raw === null || raw === '')) {
            try {
                raw = localStorage.getItem(getSearchEnginesDisplayKey(SEARCH_ENGINES_DISPLAY_SURFACE_PRIMARY));
            } catch (_) {}
            if (raw != null && raw !== '') {
                try {
                    localStorage.setItem(key, raw);
                } catch (_) {}
            }
        }
        return raw === 'grid' ? 'grid' : 'list';
    };
    const syncSearchEnginesDisplaySegmentedControl = (toggleRoot, modeNorm) => {
        if (!toggleRoot) return;
        const listSeg = toggleRoot.querySelector('.search-engines-display-segment[data-mode="list"]');
        const gridSeg = toggleRoot.querySelector('.search-engines-display-segment[data-mode="grid"]');
        if (!listSeg || !gridSeg) return;
        const grid = modeNorm === 'grid';
        listSeg.classList.toggle('search-engines-display-segment--active', !grid);
        gridSeg.classList.toggle('search-engines-display-segment--active', grid);
        listSeg.setAttribute('aria-pressed', grid ? 'false' : 'true');
        gridSeg.setAttribute('aria-pressed', grid ? 'true' : 'false');
    };
    let parentViewportInfo = null; // { viewportH: number, frameTop: number } sent by parent when in iframe
    const ensureGridIconTooltips = () => {
        document.querySelectorAll('.search-switcher-dropdown.search-engines-display-grid').forEach((dropdown) => {
            const enginesContainer = dropdown.querySelector('.dropdown-search-engines');
            if (enginesContainer) {
                enginesContainer.querySelectorAll('.dropdown-item').forEach((item) => {
                    if (!item.querySelector('.dropdown-engine-icon')) return;
                    const label = getEngineLabel(item);
                    if (label) item.title = label;
                });
            }
            const firefoxContainer = dropdown.querySelector('.dropdown-firefox-suggestions');
            if (firefoxContainer) {
                firefoxContainer.querySelectorAll('.dropdown-item-firefox-suggestion').forEach((item) => {
                    const textEl =
                        item.querySelector('.dropdown-firefox-suggestion-label') ||
                        item.querySelector('span:not(.dropdown-firefox-toggle)');
                    const label = (textEl?.textContent || '').trim();
                    if (label) item.title = label;
                });
            }
        });
    };
    const clearGridIconTooltips = () => {
        document
            .querySelectorAll(
                '.search-switcher-button .search-switcher-dropdown, .search-switcher-pinned-right-host .search-switcher-dropdown'
            )
            .forEach((dropdown) => {
                dropdown.querySelectorAll('.dropdown-search-engines .dropdown-item[title]').forEach((item) => {
                    item.removeAttribute('title');
                });
                dropdown.querySelectorAll('.dropdown-search-engines .dropdown-engine-label[title]').forEach((el) => {
                    el.removeAttribute('title');
                });
                dropdown
                    .querySelectorAll('.dropdown-firefox-suggestions .dropdown-item-firefox-suggestion[title]')
                    .forEach((item) => {
                        item.removeAttribute('title');
                    });
            });
    };
    const applySearchEnginesDisplayMode = (mode, surface = 'all', opts = {}) => {
        const skipStorage = opts.skipStorage === true;

        const applyOne = (surf, modeNorm) => {
            const isPinned = surf === SEARCH_ENGINES_DISPLAY_SURFACE_PINNED;
            const dd = isPinned
                ? document.querySelector('.search-switcher-pinned-right-host .search-switcher-dropdown')
                : document.querySelector('.search-switcher-button .search-switcher-dropdown');
            if (dd) {
                dd.classList.toggle('search-engines-display-grid', modeNorm === 'grid');
            }
            const attr = isPinned ? SEARCH_ENGINES_DISPLAY_SURFACE_PINNED : SEARCH_ENGINES_DISPLAY_SURFACE_PRIMARY;
            document.querySelectorAll(`[data-search-engines-display-toggle="${attr}"]`).forEach((toggle) => {
                syncSearchEnginesDisplaySegmentedControl(toggle, modeNorm);
            });
        };

        const finish = () => {
            clearGridIconTooltips();
            ensureGridIconTooltips();
            requestAnimationFrame(() => {
                syncSearchSwitcherDropdownWidth();
                requestAnimationFrame(() => updateListEngineLabelTruncationTooltips());
            });
        };

        if (surface === 'all') {
            const mPrimary = getSearchEnginesDisplayModeForSurface(SEARCH_ENGINES_DISPLAY_SURFACE_PRIMARY);
            const mPinned = getSearchEnginesDisplayModeForSurface(SEARCH_ENGINES_DISPLAY_SURFACE_PINNED);
            applyOne(SEARCH_ENGINES_DISPLAY_SURFACE_PRIMARY, mPrimary);
            applyOne(SEARCH_ENGINES_DISPLAY_SURFACE_PINNED, mPinned);
            const select = document.getElementById('search-engines-display-select');
            if (select) select.value = mPrimary;
            finish();
            return;
        }

        const normalized = mode === 'grid' ? 'grid' : 'list';
        if (!skipStorage) {
            try {
                localStorage.setItem(getSearchEnginesDisplayKey(surface), normalized);
            } catch (_) {}
        }
        applyOne(surface, normalized);

        if (surface === SEARCH_ENGINES_DISPLAY_SURFACE_PRIMARY) {
            const select = document.getElementById('search-engines-display-select');
            if (select) select.value = normalized;
        }
        finish();
    };
    const isUnderlineSearchEnginesEnabled = () => {
        const checkbox = document.querySelector('.underline-search-engines-checkbox');
        if (checkbox) return checkbox.checked;
        return underlineSearchEnginesEnabled;
    };

    // Address bar iframe: parent sets width (~93% / 930px cap, minus 160px, plus trailing slot); iframe reports height (including dropdown)
    if (window !== window.top) {
        window.addEventListener('message', (e) => {
            if (e.data?.type === 'search-border-color') {
                const col = e.data.color;
                if (typeof col === 'string' && normalizeSearchBorderColorInput(col)) {
                    applySearchBorderColorVariable(col);
                }
            } else if (e.data?.type === 'prototype-panel-interaction') {
                window.__prototypeOptionsBlurSuppressUntil = Date.now() + 800;
            } else if (e.data?.type === 'search-border-radius-mode') {
                const mode = e.data.mode === 'large' ? 'large' : 'small';
                try {
                    localStorage.setItem(SEARCH_BORDER_RADIUS_MODE_KEY, mode);
                } catch (_) {}
                queueMicrotask(() => {
                    try {
                        refreshSearchBorderRadiusMode();
                    } catch (_) {}
                });
            } else if (e.data?.type === 'reduced-motion') {
                if (e.data.enabled) {
                    document.body.classList.add('reduced-motion');
                } else {
                    document.body.classList.remove('reduced-motion');
                }
            } else if (e.data?.type === 'search-switcher-controls-visible') {
                try {
                    applySearchSwitcherControlsVisibleLayout();
                } catch (_) {}
            } else if (e.data?.type === 'pin-default') {
                /* List pins for “default” are retired; keep DEFAULT badge only. */
                document.body.classList.remove('pin-default-enabled');
                updateDefaultBadge();
            } else if (e.data?.type === 'search-engines-count') {
                const c = parseInt(e.data.count, 10);
                if (c === 6 || c === 12 || c === 50) applySearchEnginesCountMode(c);
            } else if (e.data?.type === 'twelve-search-engines') {
                if (e.data.count != null) {
                    const c = parseInt(e.data.count, 10);
                    if (c === 6 || c === 12 || c === 50) applySearchEnginesCountMode(c);
                } else {
                    applySearchEnginesCountMode(e.data.enabled ? 12 : 6);
                }
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
            } else if (e.data?.type === 'standalone-search-box-visible') {
                if (!document.body.classList.contains('standalone-search-box')) return;
                const standaloneSearchContainer = document.querySelector('.search-container');
                if (e.data.visible) {
                    standaloneSearchContainer?.classList.remove('standalone-search-field-hidden');
                } else {
                    standaloneSearchContainer?.classList.add('standalone-search-field-hidden');
                }
                try {
                    window.__scheduleAddressbarHeightReport?.();
                } catch (_) {}
            } else if (e.data?.type === 'mirror-default-search-engine') {
                if (typeof e.data.key === 'string' && typeof e.data.value === 'string') {
                    try {
                        localStorage.setItem(e.data.key, e.data.value);
                    } catch (_) {}
                    queueMicrotask(() => {
                        try {
                            applySearchSwitcherUIFromStoredDefault();
                        } catch (_) {}
                        try {
                            applySearchInputPlaceholderFromAccessPointSettings(null);
                        } catch (_) {}
                        try {
                            syncAddressBarNavigateOnlySwitcherIcon();
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
                    try {
                        applySearchInputPlaceholderFromAccessPointSettings(null);
                    } catch (_) {}
                    try {
                        syncAddressBarNavigateOnlySwitcherIcon();
                    } catch (_) {}
                });
            } else if (e.data?.type === 'clear-local-storage-key' && typeof e.data.key === 'string') {
                /* Opaque `file://` iframes keep their own `localStorage`; parent reset clears top only — clear here too. */
                try {
                    localStorage.removeItem(e.data.key);
                } catch (_) {}
            } else if (e.data?.type === 'refresh-search-engine-switcher-from-storage') {
                if (e.data.oldEffectiveDefault !== undefined && e.data.oldEffectiveDefault !== null) {
                    applySearchSwitcherAfterSearchSettingsChange(e.data.oldEffectiveDefault);
                } else {
                    applySearchSwitcherUIFromStoredDefault();
                }
                try {
                    syncAddressBarNavigateOnlySwitcherIcon();
                } catch (_) {}
            } else if (e.data?.type === 'refresh-search-access-point-placeholder') {
                const keys = e.data.keys;
                if (keys && typeof keys === 'object') {
                    try {
                        for (const k of SEARCH_ACCESS_POINT_SETTING_KEYS) {
                            if (!Object.prototype.hasOwnProperty.call(keys, k)) continue;
                            const v = keys[k];
                            if (v == null || v === '') {
                                try {
                                    localStorage.removeItem(k);
                                } catch (_) {}
                            } else {
                                try {
                                    localStorage.setItem(k, String(v));
                                } catch (_) {}
                            }
                        }
                    } catch (_) {}
                }
                try {
                    applySearchInputPlaceholderFromAccessPointSettings(null);
                } catch (_) {}
                try {
                    syncAddressBarNavigateOnlySwitcherIcon();
                } catch (_) {}
            } else if (e.data?.type === 'address-bar-reset-focus-like-after-load') {
                if (!document.body.classList.contains('addressbar') || document.body.classList.contains('standalone-search-box')) {
                    return;
                }
                queueMicrotask(() => {
                    try {
                        addressbarSuggestionsOpenEnabled = false;
                        firstHoverDone = false;
                        const btn = document.querySelector('.search-switcher-button');
                        const dropdown = btn?.querySelector('.search-switcher-dropdown');
                        const container = document.querySelector('.search-container');
                        const list = document.querySelector('.suggestions-list');
                        const input = document.querySelector('.search-input');
                        if (btn?.classList.contains('open')) {
                            beginSwitcherClosingShapeHoldUntilDropdownAnimation(btn);
                            forceCloseSearchSwitcherSubPanels();
                            dropdown?.classList.remove('dropdown-revealed');
                            btn.classList.remove('open', 'switcher-opened-by-keyboard', 'switcher-suppress-hover');
                            btn.querySelectorAll('.dropdown-item').forEach((item) => item.classList.remove('highlighted'));
                        }
                        if (list) {
                            list.classList.remove('suggestions-revealed', 'transitioning', 'first-hover-fade');
                        }
                        const label = btn?.querySelector('.switcher-button-label');
                        const inLocalSourceMode = label && !label.hidden;
                        const inputEmpty = !input?.value?.trim();
                        if (inLocalSourceMode && inputEmpty) {
                            list?.classList.add('suggestions-suppress-until-typed');
                            updateSuggestions([]);
                        } else {
                            list?.classList.remove('suggestions-suppress-until-typed');
                        }
                        container?.classList.remove('search-container--suggestions-panel-collapsing');
                        container?.classList.add('focused');
                        syncSearchBoxWrapperCornersForSuggestionsPanel();
                        refreshPinnedRightSwitcherPanel();
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                try {
                                    input?.focus({ preventScroll: true });
                                } catch (_) {
                                    try {
                                        input?.focus();
                                    } catch (_) {}
                                }
                            });
                        });
                    } catch (_) {}
                });
            }
        });
        const reportAddressbarHeight = () => {
            const standaloneFieldHidden =
                document.body.classList.contains('standalone-search-box') &&
                !!document.querySelector('.search-container')?.classList.contains('standalone-search-field-hidden');
            if (standaloneFieldHidden) {
                const toolbar = document.querySelector('.standalone-search-box-toolbar');
                const row = document.querySelector('.addressbar-row');
                let b = 0;
                if (toolbar) b = Math.max(b, toolbar.getBoundingClientRect().bottom);
                if (row) b = Math.max(b, row.getBoundingClientRect().bottom);
                const h = Math.max(b + 4, 44);
                window.parent.postMessage(
                    {
                        type: 'addressbar-height',
                        height: h,
                        pinnedRightChromeOpen: false,
                    },
                    '*'
                );
                return;
            }
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

            /* Pinned-right clone: position:absolute off .search-container-top-row — does not grow .search-container height. */
            const pinnedHost = container.querySelector('.search-switcher-pinned-right-host');
            const pinnedDd =
                pinnedHost && !pinnedHost.hidden
                    ? pinnedHost.querySelector('.search-switcher-dropdown.search-switcher-dropdown--pinned-right') ||
                      pinnedHost.querySelector('.search-switcher-dropdown')
                    : null;
            if (pinnedHost && !pinnedHost.hidden) {
                if (pinnedDd) {
                    const pinnedRect = pinnedDd.getBoundingClientRect();
                    const fromScroll = pinnedRect.top + pinnedDd.scrollHeight;
                    bottom = Math.max(bottom, pinnedRect.bottom, fromScroll);
                } else {
                    const hostRect = pinnedHost.getBoundingClientRect();
                    if (hostRect.height > 0) {
                        bottom = Math.max(bottom, hostRect.bottom);
                    }
                }
            }

            const h = bottom + 4;
            /* Parent treats chip switcher open as “use viewport” (see switcher-open-state). Pinned column is the same
             * layout problem (abs positioned) but never toggles .open on the chip — mirror that so the iframe grows. */
            const pinnedRightChromeOpen = !!(pinnedHost && !pinnedHost.hidden && pinnedDd);
            window.parent.postMessage(
                {
                    type: 'addressbar-height',
                    height: h,
                    pinnedRightChromeOpen,
                },
                '*'
            );
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
        const pinnedHostForHeight = container?.querySelector('.search-switcher-pinned-right-host');
        if (pinnedHostForHeight) {
            if (typeof ResizeObserver !== 'undefined') {
                new ResizeObserver(scheduleHeightReports).observe(pinnedHostForHeight);
            }
            new MutationObserver(() => scheduleHeightReports()).observe(pinnedHostForHeight, {
                attributes: true,
                attributeFilter: ['hidden', 'class'],
                childList: true,
                subtree: true
            });
        }
        window.__scheduleAddressbarHeightReport = scheduleHeightReports;
    } else {
        const iframe = document.querySelector('.addressbar-iframe');
        const standaloneIframe = document.querySelector('.standalone-search-box-iframe');
        const iframes = [iframe, standaloneIframe].filter(Boolean);
        let addressbarSwitcherOpen = false;
        let addressbarPinnedRightOpen = false;
        let standaloneSwitcherOpen = false;
        let standalonePinnedRightOpen = false;
        let lastAddressbarReportedHeight = null;
        let lastStandaloneReportedHeight = null;

        const sendPrototypeOptionsToIframes = () => {
            const searchBorderColor = getStoredSearchBorderColor();
            const searchBorderRadiusMode = getSearchBorderRadiusMode();
            const reducedMotion = localStorage.getItem('reduced_motion_enabled') === 'true';
            const underlineSearchEngines = localStorage.getItem(UNDERLINE_SEARCH_ENGINES_ENABLED_KEY) === 'true';
            const keyboardSwitcherNumbersEnabled = localStorage.getItem(KEYBOARD_SWITCHER_NUMBERS_ENABLED_KEY) !== 'false';
            const searchEnginesCount = getStoredSearchEnginesCount();
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
                    f.contentWindow?.postMessage(
                        { type: 'search-border-radius-mode', mode: searchBorderRadiusMode },
                        '*'
                    );
                    f.contentWindow?.postMessage({ type: 'reduced-motion', enabled: reducedMotion }, '*');
                    f.contentWindow?.postMessage({ type: 'pin-default', enabled: false }, '*');
                    f.contentWindow?.postMessage({ type: 'underline-search-engines', enabled: underlineSearchEngines }, '*');
                    f.contentWindow?.postMessage({ type: 'switcher-keyboard-numbers', enabled: keyboardSwitcherNumbersEnabled }, '*');
                    f.contentWindow?.postMessage({ type: 'search-engines-count', count: searchEnginesCount }, '*');
                    f.contentWindow?.postMessage(
                        { type: 'twelve-search-engines', enabled: searchEnginesCount !== 6, count: searchEnginesCount },
                        '*'
                    );
                } catch (_) {}
            });
            if (iframe) sendViewportToIframe(iframe);
            if (standaloneIframe) sendViewportToIframe(standaloneIframe);
            if (iframe) pushDefaultSearchEngineKeysToIframe(iframe.contentWindow);
            if (standaloneIframe) pushDefaultSearchEngineKeysToIframe(standaloneIframe.contentWindow);
            const placeholderKeys = getSearchAccessPointSettingsKeysForMirror();
            if (iframe) {
                try {
                    iframe.contentWindow?.postMessage(
                        { type: 'refresh-search-access-point-placeholder', keys: placeholderKeys },
                        '*'
                    );
                } catch (_) {}
            }
            if (standaloneIframe) {
                try {
                    standaloneIframe.contentWindow?.postMessage(
                        { type: 'refresh-search-access-point-placeholder', keys: placeholderKeys },
                        '*'
                    );
                } catch (_) {}
                try {
                    standaloneIframe.contentWindow?.postMessage(
                        {
                            type: 'standalone-search-box-visible',
                            visible: readStandaloneSearchBoxVisibleFromStorage(),
                        },
                        '*'
                    );
                } catch (_) {}
            }
        };

        if (iframe) {
            /* Ignore collapsed / not-yet-laid-out measurements (e.g. address bar display:none while ?chrome=0). */
            const MIN_ADDRESSBAR_IFRAME_HEIGHT = 36;
            /* Must match `.addressbar-trailing-rect` width in step1-addressbar.css */
            const ADDRESSBAR_TRAILING_RECT_WIDTH_PX = 230;
            const ADDRESSBAR_IFRAME_NARROWER_PX = 115;
            /* Toolbar row + .addressbar-band height are fixed in CSS (45px); iframe height still grows for suggestions. */
            const remeasureAddressbarBandFromIframe = () => {
                try {
                    const doc = iframe.contentDocument;
                    const container = doc?.querySelector('.search-container');
                    if (container) {
                        const h = container.getBoundingClientRect().height + 4;
                        if (h >= MIN_ADDRESSBAR_IFRAME_HEIGHT) {
                            iframe.style.height = h + 'px';
                            lastAddressbarReportedHeight = h;
                            sendPrototypeOptionsToIframes();
                            return;
                        }
                    }
                } catch (_) { /* cross-origin */ }
                sendPrototypeOptionsToIframes();
            };
            window.__prototypeRemeasureAddressbarBand = remeasureAddressbarBandFromIframe;
            const updateIframeSize = () => {
                const standaloneW = Math.min(window.innerWidth * 0.62, 620);
                /* Match step1.css --addressbar-toolbar-icons-slot: 12 + 3*35 + 2*5 */
                const standaloneToolbarIconsSlotPx = 12 + 3 * 35 + 2 * 5;
                /* Match :root --standalone-search-toolbar-extra-gap in step1.css */
                const STANDALONE_SEARCH_TOOLBAR_EXTRA_GAP_PX = 90;
                /* Match .standalone-search-box-iframe padding-right in step1.css */
                const STANDALONE_IFRAME_PADDING_RIGHT_PX = 5;
                /** Narrowest standalone iframe with search field + toolbar (px beyond icon strip + padding). */
                const STANDALONE_VISIBLE_MIN_SEARCH_COLUMN_PX = 140;
                const standaloneVisible = readStandaloneSearchBoxVisibleFromStorage();
                const standaloneWidthWhenVisible =
                    Math.round(standaloneW / 2) +
                    standaloneToolbarIconsSlotPx +
                    STANDALONE_SEARCH_TOOLBAR_EXTRA_GAP_PX +
                    STANDALONE_IFRAME_PADDING_RIGHT_PX;
                const standaloneWidthWhenHidden =
                    standaloneToolbarIconsSlotPx + 8 + STANDALONE_IFRAME_PADDING_RIGHT_PX;
                const standalonePref = standaloneVisible ? standaloneWidthWhenVisible : standaloneWidthWhenHidden;
                const standaloneMin = standaloneVisible
                    ? standaloneToolbarIconsSlotPx +
                      STANDALONE_IFRAME_PADDING_RIGHT_PX +
                      STANDALONE_VISIBLE_MIN_SEARCH_COLUMN_PX
                    : standaloneWidthWhenHidden;

                /* .addressbar-area left 20px + .addressbar-iframe-anchor margin-left 20px */
                const ADDRESSBAR_ROW_LEFT_GUTTER_PX = 40;
                const ADDRESSBAR_ROW_GAP_PX = 12;
                const ADDRESSBAR_ROW_RIGHT_BUFFER_PX = 16;
                const ADDRESSBAR_ADDRESS_IFRAME_MIN_W = 200;
                const available = Math.max(
                    0,
                    window.innerWidth -
                        ADDRESSBAR_ROW_LEFT_GUTTER_PX -
                        ADDRESSBAR_ROW_GAP_PX -
                        ADDRESSBAR_ROW_RIGHT_BUFFER_PX
                );

                let addressbarPref = Math.max(
                    0,
                    Math.min(window.innerWidth * 0.93, 930) -
                        160 +
                        ADDRESSBAR_TRAILING_RECT_WIDTH_PX -
                        ADDRESSBAR_IFRAME_NARROWER_PX
                );
                if (!standaloneVisible) {
                    addressbarPref += standaloneWidthWhenVisible - standaloneWidthWhenHidden;
                }

                let standaloneTargetW = standalonePref;
                let addressbarW = addressbarPref;
                const slack = available - standaloneTargetW - addressbarW;
                if (slack < 0) {
                    let deficit = -slack;
                    const canShrinkStandalone = Math.max(0, standaloneTargetW - standaloneMin);
                    const takeStandalone = Math.min(canShrinkStandalone, deficit);
                    standaloneTargetW -= takeStandalone;
                    deficit -= takeStandalone;
                    if (deficit > 0) {
                        const canShrinkAddress = Math.max(0, addressbarW - ADDRESSBAR_ADDRESS_IFRAME_MIN_W);
                        const takeAddress = Math.min(canShrinkAddress, deficit);
                        addressbarW -= takeAddress;
                        deficit -= takeAddress;
                    }
                    if (deficit > 0) {
                        standaloneTargetW = Math.max(standaloneMin, standaloneTargetW - deficit);
                        addressbarW = Math.max(0, available - standaloneTargetW);
                    }
                }

                if (standaloneIframe) {
                    standaloneIframe.style.width = Math.round(standaloneTargetW) + 'px';
                }
                iframe.style.width = Math.round(addressbarW) + 'px';
            };
            const setHeight = (e) => {
                if (e.data?.type === 'addressbar-height' && typeof e.data.height === 'number') {
                    let h = e.data.height;
                    if (e.source === iframe.contentWindow) {
                        addressbarPinnedRightOpen = !!e.data.pinnedRightChromeOpen;
                        lastAddressbarReportedHeight = h;
                        // Clamp to viewport bottom (top window knows its own viewport).
                        try {
                            const r = iframe.getBoundingClientRect();
                            const bottomPadding = 8;
                            const maxAllowed = Math.max(0, Math.floor(window.innerHeight - r.top - bottomPadding));
                            if (addressbarSwitcherOpen || addressbarPinnedRightOpen) {
                                h = maxAllowed;
                            } else {
                                h = Math.min(h, maxAllowed);
                            }
                        } catch (_) {}
                        if (addressbarSwitcherOpen || addressbarPinnedRightOpen || h >= MIN_ADDRESSBAR_IFRAME_HEIGHT) {
                            iframe.style.height = h + 'px';
                        }
                    } else if (standaloneIframe && e.source === standaloneIframe.contentWindow) {
                        standalonePinnedRightOpen = !!e.data.pinnedRightChromeOpen;
                        lastStandaloneReportedHeight = h;
                        try {
                            const r = standaloneIframe.getBoundingClientRect();
                            const bottomPadding = 8;
                            const maxAllowed = Math.max(0, Math.floor(window.innerHeight - r.top - bottomPadding));
                            if (standaloneSwitcherOpen || standalonePinnedRightOpen) {
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
                                const pinnedStillOpen =
                                    (targetIframe === iframe && addressbarPinnedRightOpen) ||
                                    (targetIframe === standaloneIframe && standalonePinnedRightOpen);
                                restoreH = pinnedStillOpen ? maxAllowed : Math.min(restoreH, maxAllowed);
                                targetIframe.style.height = restoreH + 'px';
                            }
                        } catch (_) {}
                    }
                }
            };
            updateIframeSize();
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
                        if (h >= MIN_ADDRESSBAR_IFRAME_HEIGHT) {
                            iframe.style.height = h + 'px';
                            lastAddressbarReportedHeight = h;
                        }
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
        const prototypeToolbarRestoreHint = document.getElementById('prototype-toolbar-restore-hint');
        const tabStripSimulationRibbon = document.querySelector('.window-chrome-tab-strip-simulation-ribbon');
        /** Match hide-toolbar help modal: F11 / Fn+F11 on Windows & Linux; Cmd+Shift+F on Apple platforms. Windows wins if UA looks like Mac (VM / odd builds). */
        const isPrototypeMacLikeOsForFullscreenToolbarShortcut = () => {
            const ua = navigator.userAgent || '';
            const p = navigator.platform || '';
            if (/Win/i.test(ua) || /^Win/i.test(p) || p === 'Win32' || p === 'Win64') {
                return false;
            }
            return (
                /Mac|iPhone|iPad|iPod/i.test(p) ||
                /Mac OS X|Macintosh/i.test(ua)
            );
        };

        const syncPrototypeToolbarRestoreHint = () => {
            const showChromelessViewportUi =
                typeof window.__isViewportChromelessPrototypeUi === 'function'
                    ? window.__isViewportChromelessPrototypeUi()
                    : Math.abs(window.innerHeight - window.outerHeight) <=
                      (window.__VIEWPORT_CHROME_HEIGHT_GAP_THRESHOLD_PX ?? 60);
            if (tabStripSimulationRibbon) {
                tabStripSimulationRibbon.hidden = !showChromelessViewportUi;
            }
            if (!prototypeToolbarRestoreHint) return;
            const isMac = isPrototypeMacLikeOsForFullscreenToolbarShortcut();
            /* Non-Mac: primary <kbd>F11</kbd> (same as .hide-toolbar-help-fullscreen-win). Mac: Cmd+Shift+F (same as .hide-toolbar-help-fullscreen-mac). */
            prototypeToolbarRestoreHint.innerHTML = isMac
                ? `<span class="prototype-toolbar-restore-hint-keys"><kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd></span> <span class="prototype-toolbar-restore-hint-caption">to get the real toolbar back</span>`
                : `<span class="prototype-toolbar-restore-hint-keys"><kbd>F11</kbd></span> <span class="prototype-toolbar-restore-hint-caption">to get the real toolbar back</span>`;
            prototypeToolbarRestoreHint.hidden = !showChromelessViewportUi;
        };
        syncPrototypeToolbarRestoreHint();
        window.addEventListener('resize', syncPrototypeToolbarRestoreHint);
        window.addEventListener('orientationchange', syncPrototypeToolbarRestoreHint);
        window.visualViewport?.addEventListener?.('resize', syncPrototypeToolbarRestoreHint);
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
    const addressbarColumnIframe =
        document.body.classList.contains('addressbar') &&
        !document.body.classList.contains('standalone-search-box');
    /** Address bar column only: suggestions open after first pointerdown in the search UI, not on initial autofocus. */
    let addressbarSuggestionsOpenEnabled = !addressbarColumnIframe;
    const searchBoxWrapper = document.querySelector('.search-box-wrapper');
    const searchBoxWrapperOuter = document.querySelector('.search-box-wrapper-outer');

    /* Avoid animating border-radius on first paint when JS applies large-mode inline radii (step1.css transition). */
    if (searchBoxWrapper) {
        searchBoxWrapper.classList.add('search-box-wrapper--instant-border-radius');
    }

    function clearJsBorderRadiusStyles() {
        if (searchBoxWrapper) searchBoxWrapper.style.borderRadius = '';
        if (searchBoxWrapperOuter) {
            searchBoxWrapperOuter.style.borderRadius = '';
            searchBoxWrapperOuter.style.removeProperty('--suggestions-ring-extend');
        }
        document.documentElement.style.removeProperty('--search-box-wrapper-radius');
        document.documentElement.style.removeProperty('--outer-border-radius');
        document.documentElement.style.removeProperty('--switcher-button-radius');
        document.documentElement.style.removeProperty('--suggestion-item-radius');
        document.documentElement.style.removeProperty('--window-chrome-tab-border-radius');
        document.documentElement.style.removeProperty('--window-chrome-tab-close-border-radius');
        document.documentElement.style.removeProperty('--window-chrome-tab-control-border-radius');
        document.documentElement.style.removeProperty('--window-chrome-tab-favicon-radius');
        syncSearchBoxWrapperCornersForSuggestionsPanel();
    }

    /** Main page only: overlay suggestions do not expand .search-box-wrapper-outer — extend the focus ring to the list bottom. */
    function updateSuggestionsRingExtend() {
        if (document.body.classList.contains('addressbar')) {
            searchBoxWrapperOuter?.style.removeProperty('--suggestions-ring-extend');
            return;
        }
        const outer = searchBoxWrapperOuter;
        const list = document.querySelector('.suggestions-list');
        if (!outer) return;
        if (!list) {
            outer.style.removeProperty('--suggestions-ring-extend');
            return;
        }
        const outerRect = outer.getBoundingClientRect();
        const listRect = list.getBoundingClientRect();
        const extra = Math.max(0, Math.round(listRect.bottom - outerRect.bottom));
        outer.style.setProperty('--suggestions-ring-extend', `${extra}px`);
    }

    /** True while the suggestions strip can show (.focused + not suppress), or while the panel is collapsing so
     * bottom corners stay square until max-height finishes (see closeSuggestionsPanel). */
    function shouldSquareSearchInputBottomForSuggestions() {
        const list = document.querySelector('.suggestions-list');
        if (!list) return false;
        if (searchContainer?.classList.contains('search-container--suggestions-panel-collapsing')) return true;
        /* Address bar column: suggestions stay visually closed until .suggestions-revealed — keep a full pill on autofocus. */
        if (addressbarColumnIframe && !list.classList.contains('suggestions-revealed')) {
            return false;
        }
        return (
            !!searchContainer?.classList.contains('focused') &&
            !list.classList.contains('suggestions-suppress-until-typed')
        );
    }

    function applySearchBoxWrapperBorderRadius(wrapperRoundedPx) {
        if (!searchBoxWrapper || wrapperRoundedPx == null || !Number.isFinite(wrapperRoundedPx)) return;
        const sq = shouldSquareSearchInputBottomForSuggestions();
        searchBoxWrapper.style.borderRadius = sq
            ? `${wrapperRoundedPx}px ${wrapperRoundedPx}px 0 0`
            : `${wrapperRoundedPx}px`;
    }

    function syncSearchBoxWrapperCornersForSuggestionsPanel() {
        if (!searchBoxWrapper) return;
        if (getSearchBorderRadiusMode() === 'large') {
            const h = searchBoxWrapper.offsetHeight;
            if (h <= 0) return;
            applySearchBoxWrapperBorderRadius(h / 2);
        } else {
            searchBoxWrapper.style.borderRadius = shouldSquareSearchInputBottomForSuggestions() ? '10px 10px 0 0' : '';
        }
    }

    /** Main page only (`.window-chrome-tab-strip` absent in address bar iframes): pill tabs / controls in large-corner mode. */
    function syncWindowChromeTabStripCornerRadii() {
        if (!document.querySelector('.window-chrome-tab-strip')) return;
        if (getSearchBorderRadiusMode() !== 'large') return;
        const tab = document.querySelector('.window-chrome-tab');
        if (tab && tab.offsetHeight > 0) {
            document.documentElement.style.setProperty('--window-chrome-tab-border-radius', `${tab.offsetHeight / 2}px`);
        }
        const close = document.querySelector('.window-chrome-tab-close');
        if (close && close.offsetHeight > 0) {
            document.documentElement.style.setProperty('--window-chrome-tab-close-border-radius', `${close.offsetHeight / 2}px`);
        }
        const controlEl =
            document.querySelector('.window-chrome-tab-strip-view-button') ||
            document.querySelector('.window-chrome-tabs-plus');
        if (controlEl && controlEl.offsetHeight > 0) {
            document.documentElement.style.setProperty(
                '--window-chrome-tab-control-border-radius',
                `${controlEl.offsetHeight / 2}px`
            );
        }
        const fav = document.querySelector('.window-chrome-tab-favicon');
        if (fav && fav.offsetHeight > 0) {
            document.documentElement.style.setProperty('--window-chrome-tab-favicon-radius', `${fav.offsetHeight / 2}px`);
        }
    }

    function updateBorderRadius() {
        if (getSearchBorderRadiusMode() !== 'large') {
            syncSearchBoxWrapperCornersForSuggestionsPanel();
            return;
        }
        let wrapperRadiusPx = null;
        if (searchBoxWrapper && searchBoxWrapperOuter) {
            const wrapperHeight = searchBoxWrapper.offsetHeight;
            const borderRadius = wrapperHeight / 2;
            wrapperRadiusPx = borderRadius;
            const gradientBorderRadius = borderRadius + 2;

            applySearchBoxWrapperBorderRadius(borderRadius);
            searchBoxWrapperOuter.style.borderRadius = `${borderRadius}px`;
            document.documentElement.style.setProperty('--search-box-wrapper-radius', `${borderRadius}px`);
            document.documentElement.style.setProperty('--outer-border-radius', `${gradientBorderRadius}px`);
        }

        const searchSwitcherBtn = document.querySelector('.search-switcher-button');
        if (searchSwitcherBtn) {
            const buttonHeight = searchSwitcherBtn.offsetHeight;
            const halfFromHeight = buttonHeight / 2;
            const maxVsWrapper =
                wrapperRadiusPx != null ? Math.max(4, wrapperRadiusPx - 2) : halfFromHeight;
            const buttonBorderRadius = Math.min(halfFromHeight, maxVsWrapper);
            document.documentElement.style.setProperty('--switcher-button-radius', `${buttonBorderRadius}px`);
        }

        const firstSuggestionItem = document.querySelector('.suggestion-item');
        if (firstSuggestionItem) {
            const itemHeight = firstSuggestionItem.offsetHeight;
            const isAddressbar = document.body.classList.contains('addressbar');
            const minRadius = isAddressbar ? 10 : 15;
            const itemBorderRadius = itemHeight > 0 ? itemHeight / 2 : minRadius;
            document.documentElement.style.setProperty('--suggestion-item-radius', `${itemBorderRadius}px`);
        }

        syncWindowChromeTabStripCornerRadii();
    }

    function syncSearchBorderRadiusSwatches() {
        const mode = getSearchBorderRadiusMode();
        document.querySelectorAll('.search-border-radius-swatch').forEach((btn) => {
            const isLarge = btn.dataset.searchBorderRadius === 'large';
            const pressed = mode === 'large' ? isLarge : !isLarge;
            btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
        });
    }

    function refreshSearchBorderRadiusMode() {
        searchBoxWrapper?.classList.add('search-box-wrapper--instant-border-radius');
        const large = getSearchBorderRadiusMode() === 'large';
        document.body.classList.toggle('search-border-radius-large', large);
        if (large) {
            updateBorderRadius();
        } else {
            clearJsBorderRadiusStyles();
        }
        syncSearchBorderRadiusSwatches();
        requestAnimationFrame(() => {
            updateSuggestionsRingExtend();
            syncSearchBoxWrapperCornersForSuggestionsPanel();
            requestAnimationFrame(() => {
                searchBoxWrapper?.classList.remove('search-box-wrapper--instant-border-radius');
            });
        });
    }

    refreshSearchBorderRadiusMode();

    window.addEventListener('resize', () => {
        updateBorderRadius();
        requestAnimationFrame(() => {
            updateSuggestionsRingExtend();
            syncSearchBoxWrapperCornersForSuggestionsPanel();
        });
    });

    if (typeof ResizeObserver !== 'undefined' && searchBoxWrapperOuter && !document.body.classList.contains('addressbar')) {
        const listForRing = document.querySelector('.suggestions-list');
        if (listForRing) {
            const scheduleSearchCardLayoutSync = () =>
                requestAnimationFrame(() => {
                    updateSuggestionsRingExtend();
                    syncSearchBoxWrapperCornersForSuggestionsPanel();
                });
            const ringExtendObserver = new ResizeObserver(scheduleSearchCardLayoutSync);
            ringExtendObserver.observe(listForRing);
            ringExtendObserver.observe(searchBoxWrapperOuter);
            scheduleSearchCardLayoutSync();
        }
    }

    if (searchContainer) {
        new MutationObserver(() => requestAnimationFrame(syncSearchBoxWrapperCornersForSuggestionsPanel)).observe(
            searchContainer,
            { attributes: true, attributeFilter: ['class'] }
        );
    }
    const suggestionsListForCornerSync = document.querySelector('.suggestions-list');
    if (suggestionsListForCornerSync) {
        new MutationObserver(() => requestAnimationFrame(syncSearchBoxWrapperCornersForSuggestionsPanel)).observe(
            suggestionsListForCornerSync,
            { attributes: true, attributeFilter: ['class'] }
        );
    }

    document.querySelectorAll('.search-border-radius-swatch').forEach((btn) => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.searchBorderRadius === 'large' ? 'large' : 'small';
            try {
                localStorage.setItem(SEARCH_BORDER_RADIUS_MODE_KEY, mode);
            } catch (_) {}
            refreshSearchBorderRadiusMode();
            if (window === window.top) {
                [document.querySelector('.addressbar-iframe'), document.querySelector('.standalone-search-box-iframe')]
                    .filter(Boolean)
                    .forEach((f) => {
                        try {
                            f.contentWindow?.postMessage({ type: 'search-border-radius-mode', mode }, '*');
                        } catch (_) {}
                    });
            }
        });
    });

    const reducedMotionCheckbox = document.querySelector('.reduced-motion-checkbox');
    const suggestionsList = document.querySelector('.suggestions-list');
    /** Seed strings under “Your Recent Searches” when history is empty — icons come from `updateSuggestions` + `getIconForSuggestion`. */
    const DEFAULT_RECENT_SEARCH_SUGGESTION_SEEDS = [
        'hoka',
        '13 in macbook air',
        'coffee machines for sale',
        'taylor swift',
        'coffee grinder',
    ];
    const suggestionItems = document.querySelectorAll('.suggestion-item');
    let selectedSuggestionIndex = -1;
    let hoveredSuggestionIndex = -1;
    let lastTypedTextInInput = '';
    let lastHoveredItemForInput = null;
    const searchSwitcherButton = document.querySelector('.search-switcher-button');
    const pinnedRightHost = document.querySelector('.search-switcher-pinned-right-host');
    const searchClearButton = document.querySelector('.search-clear-button');
    const searchUrlButton = document.querySelector('.search-url-button');
    const searchButton = document.querySelector('.search-button');
    const clearCacheButton = document.getElementById('clear-cache-button');
    let clearCacheSuccessTimer = null;
    let switcherHighlightedIndex = -1;
    let switcherHoveredIndex = -1;
    let restoringFocusFromSwitcher = false;
    let closingSwitcherWithoutSuggestions = false;
    /** Pin panel while suggestions were closed: focus handler must not strip suggestions-revealed. */
    let openingSuggestionsForPinPanel = false;
    /** True between mousedown and mouseup on the pinned-right engine panel (avoids premature blur close). */
    let pinnedRightHostPointerActive = false;
    /** Leaving pinned-right: refocus search without running the full focus path (preserves suggestions state). */
    let focusAfterUnpinPinnedRight = false;
    /** Set by the engine-reorder block when `enginesContainer` exists; starts drag from pinned clone rows. */
    let engineReorderHandlePinnedCloneMousedown = null;
    /** Assigned when the default-badge drag mousedown listener is installed; pinned clone calls this instead of forwarding to the chip. */
    let handleDefaultBadgeDragMouseDown = null;

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
        const list = suggestionsList;
        const closeDuration = document.body.classList.contains('addressbar') ? 320 : 250;
        const reducedMotion = document.body.classList.contains('reduced-motion');

        if (!list) {
            searchContainer.classList.remove('focused');
            searchContainer.classList.remove('search-container--suggestions-panel-collapsing');
            suggestionsList?.classList.remove('suggestions-revealed');
            firstHoverDone = false;
            syncSearchBoxWrapperCornersForSuggestionsPanel();
            refreshPinnedRightSwitcherPanel();
            return;
        }

        searchContainer.classList.add('search-container--suggestions-panel-collapsing');
        searchContainer.classList.remove('focused');
        list.classList.remove('suggestions-revealed');
        firstHoverDone = false;

        let collapseRoundingSettled = false;
        let collapseRoundingFallbackTimer = null;

        const finishPanelCollapseRounding = () => {
            if (!searchContainer.classList.contains('search-container--suggestions-panel-collapsing')) return;
            searchContainer.classList.remove('search-container--suggestions-panel-collapsing');
            if (searchBoxWrapper) {
                searchBoxWrapper.classList.add('search-box-wrapper--instant-border-radius');
                syncSearchBoxWrapperCornersForSuggestionsPanel();
                requestAnimationFrame(() => {
                    searchBoxWrapper.classList.remove('search-box-wrapper--instant-border-radius');
                });
            } else {
                syncSearchBoxWrapperCornersForSuggestionsPanel();
            }
        };

        const settleCollapseRounding = () => {
            if (collapseRoundingSettled) return;
            collapseRoundingSettled = true;
            list.removeEventListener('transitionend', onSuggestionsCollapseTransitionEnd);
            if (collapseRoundingFallbackTimer != null) {
                clearTimeout(collapseRoundingFallbackTimer);
                collapseRoundingFallbackTimer = null;
            }
            finishPanelCollapseRounding();
        };

        const onSuggestionsCollapseTransitionEnd = (e) => {
            if (e.target !== list || e.propertyName !== 'max-height') return;
            settleCollapseRounding();
        };

        list.addEventListener('transitionend', onSuggestionsCollapseTransitionEnd);
        const waitMs = reducedMotion ? 0 : closeDuration + 40;
        collapseRoundingFallbackTimer = setTimeout(settleCollapseRounding, waitMs);

        list.classList.add('transitioning');
        list.classList.remove('first-hover-fade');
        setTimeout(() => {
            list.classList.remove('transitioning');
        }, closeDuration);

        refreshPinnedRightSwitcherPanel();
    }

    /** Close chip dropdown + suggestions + blur; hides the cloned panel but keeps pinned-right mode (reopens on input focus). */
    function collapseSearchUiPreservingPinned() {
        if (!searchSwitcherButton) {
            closeSuggestionsPanel();
            try {
                searchInput?.blur?.();
            } catch (_) {}
            return;
        }
        restoringFocusFromSwitcher = false;
        closingSwitcherWithoutSuggestions = false;
        if (searchSwitcherButton.classList.contains('open')) {
            const dropdown = searchSwitcherButton.querySelector('.search-switcher-dropdown');
            beginSwitcherClosingShapeHoldUntilDropdownAnimation(searchSwitcherButton);
            searchSwitcherButton.classList.remove('switcher-opened-by-keyboard');
            dropdown?.classList.remove('dropdown-revealed');
            switcherHighlightedIndex = -1;
            searchSwitcherButton.classList.remove('switcher-suppress-hover');
            searchSwitcherButton.querySelectorAll('.dropdown-item').forEach((item) => item.classList.remove('highlighted'));
            forceCloseSearchSwitcherSubPanels();
            searchSwitcherButton.classList.remove('open');
        } else {
            forceCloseSearchSwitcherSubPanels();
        }
        autoOpenedSwitcherOnFocus = false;
        closeSuggestionsPanel();
        try {
            searchInput?.blur?.();
        } catch (_) {}
    }

    /** Main new tab only: mousedown outside the hero search card dismisses an open suggestions panel (and switcher). */
    document.addEventListener(
        'mousedown',
        (e) => {
            if (document.body.classList.contains('addressbar')) return;
            if (!suggestionsList?.classList.contains('suggestions-revealed')) return;
            if (!searchContainer?.classList.contains('focused')) return;
            const t = e.target;
            if (!t || typeof t.closest !== 'function') return;
            if (t.closest('.search-container')) return;
            const helpRoot = document.getElementById('hide-toolbar-help-root');
            if (helpRoot && !helpRoot.hidden && t.closest('#hide-toolbar-help-root')) return;
            const ssModal = document.getElementById('search-settings-modal');
            if (ssModal && !ssModal.hidden && t.closest('#search-settings-modal')) return;
            if (t.closest('.bottom-left-panel')) return;
            collapseSearchUiPreservingPinned();
        },
        false
    );

    /** Close the chip’s search-switcher dropdown (and sub-panels) while keeping suggestions + input focus — e.g. after pinning the engine list to the right. */
    function closePrimarySearchSwitcherDropdownKeepingSuggestions() {
        if (!searchSwitcherButton) return;
        const wasOpen = searchSwitcherButton.classList.contains('open');
        if (!wasOpen) {
            forceCloseSearchSwitcherSubPanels();
            return;
        }
        beginSwitcherClosingShapeHoldUntilDropdownAnimation(searchSwitcherButton);
        searchSwitcherButton.classList.remove('switcher-opened-by-keyboard');
        const primaryDd = searchSwitcherButton.querySelector('.search-switcher-dropdown');
        primaryDd?.classList.remove('dropdown-revealed');
        switcherHighlightedIndex = -1;
        searchSwitcherButton.classList.remove('switcher-suppress-hover');
        searchSwitcherButton.querySelectorAll('.dropdown-item').forEach((item) => item.classList.remove('highlighted'));
        if (searchContainer?.classList.contains('focused')) {
            restoreFocusAndOpaqueSuggestions();
        }
        restoringFocusFromSwitcher = false;
        closingSwitcherWithoutSuggestions = false;
        forceCloseSearchSwitcherSubPanels();
        searchSwitcherButton.classList.remove('open');
        if (window !== window.top) {
            try {
                window.parent.postMessage({ type: 'switcher-open-state', open: false }, '*');
            } catch (_) {}
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
                        updateSuggestions(DEFAULT_RECENT_SEARCH_SUGGESTION_SEEDS);
                        if (!addressbarColumnIframe || addressbarSuggestionsOpenEnabled) {
                            suggestionsList?.classList.add('suggestions-revealed');
                        }
                    }
                }
            }
            if (searchInput) {
                applySearchInputPlaceholderFromAccessPointSettings(label);
            }
            // Update "Search with X" hints on existing suggestion items
            const hint = 'Search with ' + label;
            document.querySelectorAll('.suggestion-item:not(.gmail-item):not(.firefox-suggest-item):not(.visit-site-suggestion) .suggestion-hint-text').forEach(el => {
                el.dataset.searchHint = hint;
            });
            syncMainScreenBrandFromSwitcherItem(item);
        }
        syncAddressBarNavigateOnlySwitcherIcon();
    }

    function getEngineLabel(item) {
        if (!item) return '';
        const labelEl = item.querySelector('.dropdown-engine-label');
        if (labelEl) return labelEl.textContent.trim();
        if (item.classList.contains('dropdown-item-firefox-suggestion')) {
            const lab = item.querySelector('.dropdown-firefox-suggestion-label');
            if (lab) return lab.textContent.replace(/\s+/g, ' ').trim();
            const toggle = item.querySelector('.dropdown-firefox-toggle');
            for (const node of item.children) {
                if (node === toggle || node.classList?.contains('dropdown-firefox-toggle')) continue;
                if (node.tagName === 'SPAN') {
                    const t = node.textContent.replace(/\s+/g, ' ').trim();
                    if (t) return t;
                }
            }
        }
        return '';
    }

    /** For strapline copy only: drop parentheticals, e.g. "Wikipedia (en)" → "Wikipedia". */
    function straplineSearchEngineDisplayName(label) {
        const s = String(label || '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
        return s || label;
    }

    /** After `src` is set: show the hero wordmark (used when hiding cross-layout flashes). */
    function revealMainScreenWordmarkWhenReady(img) {
        const show = () => {
            img.style.removeProperty('opacity');
        };
        if (typeof img.decode === 'function') {
            img.decode().then(show, show);
        } else {
            const done = () => {
                img.onload = null;
                img.onerror = null;
                show();
            };
            img.onload = done;
            img.onerror = done;
            if (img.complete && img.naturalWidth > 0) {
                done();
            }
        }
    }

    /** Drives CSS hero treatments for Google on grey vs purple-gradient backgrounds (main page only). */
    function syncMainScreenHeroEngineLabelDatasetForBody(engineLabel, heroFirefox) {
        if (typeof document === 'undefined' || !document.body) return;
        if (document.body.classList.contains('addressbar')) return;
        if (heroFirefox) {
            delete document.body.dataset.mainScreenHeroEngineLabel;
        } else {
            document.body.dataset.mainScreenHeroEngineLabel = engineLabel;
        }
    }

    /** Main-page hero wordmark + strapline track the switcher’s selected web search engine (full SVG wordmarks for Google / DuckDuckGo). */
    function syncMainScreenBrandFromSwitcherItem(item) {
        const container = document.querySelector('.main-screen-brand-logos');
        if (!container) return;
        const slot = container.querySelector('.main-screen-engine-wordmark-slot');
        const wordmark = container.querySelector('.main-screen-engine-wordmark');
        const attribution = container.querySelector('.main-screen-brand-attribution');
        const engineNameEl = container.querySelector('.main-screen-brand-engine-name');
        if (!wordmark || !attribution || !engineNameEl) return;
        const label = getEngineLabel(item);
        if (!label) {
            if (typeof document !== 'undefined' && document.body && !document.body.classList.contains('addressbar')) {
                try {
                    delete document.body.dataset.mainScreenHeroEngineLabel;
                } catch (_) {}
            }
            return;
        }
        const heroFirefox = getMainScreenHeroLogoMode() === 'firefox';
        const clearIconFallbackLayout = () => {
            wordmark.removeAttribute('data-wordmark-icon-fallback');
            slot?.classList.remove(
                'main-screen-engine-wordmark-slot--icon-fallback',
                'main-screen-engine-wordmark-slot--standard-icon'
            );
        };
        const localSources = ['Bookmarks', 'History', 'Tabs', 'Actions'];
        if (localSources.includes(label)) {
            if (!heroFirefox) {
                const fromIconFallback = wordmark.hasAttribute('data-wordmark-icon-fallback');
                if (fromIconFallback) {
                    wordmark.style.opacity = '0';
                }
                wordmark.dataset.wordmarkHeroSize = 'large';
                clearIconFallbackLayout();
                wordmark.src = resolveMainScreenHeroGoogleWordmarkSrc(MAIN_SCREEN_GOOGLE_LOGO_HERO_SRC);
                if (fromIconFallback) {
                    revealMainScreenWordmarkWhenReady(wordmark);
                } else {
                    wordmark.style.removeProperty('opacity');
                }
            } else {
                clearIconFallbackLayout();
            }
            engineNameEl.textContent = 'Google';
            syncMainScreenHeroEngineLabelDatasetForBody(label, heroFirefox);
            return;
        }
        let src = MAIN_SCREEN_HORIZONTAL_ENGINE_LOGOS[label];
        if (!src) {
            const iconEl = item.querySelector('.dropdown-engine-icon, .dropdown-icon');
            src = iconEl ? iconEl.getAttribute('src') || iconEl.src : MAIN_SCREEN_GOOGLE_LOGO_HERO_SRC;
        }
        src = resolveMainScreenHeroGoogleWordmarkSrc(src);
        const heroSize = label === 'Bing' || label === 'Wikipedia (en)' ? 'standard' : 'large';
        const nextIconFallback = !MAIN_SCREEN_HORIZONTAL_ENGINE_LOGOS[label];
        const prevIconFallback = wordmark.hasAttribute('data-wordmark-icon-fallback');
        const crossIconWordmarkLayout = nextIconFallback !== prevIconFallback;
        if (!heroFirefox) {
            if (crossIconWordmarkLayout) {
                wordmark.style.opacity = '0';
            } else {
                wordmark.style.removeProperty('opacity');
            }
            wordmark.dataset.wordmarkHeroSize = heroSize;
            if (MAIN_SCREEN_HORIZONTAL_ENGINE_LOGOS[label]) {
                clearIconFallbackLayout();
            } else {
                wordmark.setAttribute('data-wordmark-icon-fallback', 'true');
                slot?.classList.add('main-screen-engine-wordmark-slot--icon-fallback');
                if (heroSize === 'standard') {
                    slot?.classList.add('main-screen-engine-wordmark-slot--standard-icon');
                } else {
                    slot?.classList.remove('main-screen-engine-wordmark-slot--standard-icon');
                }
            }
            wordmark.src = src;
            if (crossIconWordmarkLayout) {
                revealMainScreenWordmarkWhenReady(wordmark);
            }
        } else {
            clearIconFallbackLayout();
        }
        engineNameEl.textContent = straplineSearchEngineDisplayName(label);
        syncMainScreenHeroEngineLabelDatasetForBody(label, heroFirefox);
    }

    function iconSrcRoughMatch(a, b) {
        if (!a || !b) return false;
        if (a === b) return true;
        const norm = (s) => s.replace(/^.*\/icons\//, 'icons/').replace(/^\.\//, '');
        return norm(a) === norm(b);
    }

    /** Row in the switcher that matches the chip (icon or local-source label) — same idea as keyboard engine cycling. */
    function getDropdownItemMatchingSearchBarChip() {
        if (!searchSwitcherButton) return null;
        const enginesContainer = searchSwitcherButton.querySelector('.dropdown-search-engines');
        const pinned = enginesContainer?.querySelector('.dropdown-item-pinned') ?? null;
        if (!enginesContainer) return pinned;

        const engineItems = Array.from(enginesContainer.children).filter(
            (c) =>
                c.classList.contains('dropdown-item') &&
                c.querySelector('.dropdown-engine-label') &&
                c.style.display !== 'none'
        );

        const switcherLabel = searchSwitcherButton.querySelector('.switcher-button-label');
        const switcherIcon = searchSwitcherButton.querySelector('.google-icon');

        if (switcherLabel && !switcherLabel.hidden && switcherLabel.textContent.trim()) {
            const want = switcherLabel.textContent.trim();
            const firefoxRows = searchSwitcherButton.querySelectorAll(
                '.dropdown-firefox-suggestions .dropdown-item-firefox-suggestion'
            );
            for (const row of firefoxRows) {
                if (getEngineLabel(row) === want) return row;
            }
            const byLabel = engineItems.find((item) => getEngineLabel(item) === want);
            if (byLabel) return byLabel;
            return pinned || engineItems[0] || null;
        }

        const iconSrc = switcherIcon?.getAttribute('src') || '';
        const idx = engineItems.findIndex((item) => {
            const iconEl = item.querySelector('.dropdown-engine-icon, .dropdown-icon');
            return iconEl && iconSrcRoughMatch(iconEl.getAttribute('src') || '', iconSrc);
        });
        if (idx >= 0) return engineItems[idx];
        return pinned || engineItems[0] || null;
    }

    /** Address bar iframe: Search settings “Search” off → globe on the chip; Search on → engine icon from current chip selection. */
    function syncAddressBarNavigateOnlySwitcherIcon() {
        if (!document.body.classList.contains('addressbar')) return;
        if (document.body.classList.contains('standalone-search-box')) return;
        try {
            applyAddressBarNavigateOnlySwitcherChrome();
        } catch (_) {}
        if (document.body.classList.contains('search-engine-list-mode-pinned-right')) {
            try {
                refreshPinnedRightSwitcherPanel();
            } catch (_) {}
        }
        const img = searchSwitcherButton?.querySelector('.google-icon');
        if (!img) return;
        if (!isSearchEnabledForAccessPoint('address-bar')) {
            img.src = ADDRESSBAR_NAVIGATE_ONLY_SWITCHER_ICON_SRC;
            img.alt = '';
            return;
        }
        const row = getDropdownItemMatchingSearchBarChip();
        if (!row) return;
        const iconEl = row.querySelector('.dropdown-engine-icon, .dropdown-icon');
        const lab = getEngineLabel(row);
        if (iconEl && lab) {
            img.src = iconEl.getAttribute('src') || iconEl.src || img.src;
            img.alt = lab;
        }
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

    /**
     * When the chip dropdown is closed but the pinned-right clone shows the engine list, hit-testing
     * (drop markers, grid, default-badge drag) must use the clone’s `.dropdown-search-engines`.
     */
    function getHitTestEnginesContainerForReorder(enginesContainer) {
        if (!enginesContainer) return null;
        if (!document.body.classList.contains('search-engine-list-mode-pinned-right')) {
            return enginesContainer;
        }
        if (!pinnedRightHost || pinnedRightHost.hidden) {
            return enginesContainer;
        }
        const cloneEc = pinnedRightHost.querySelector('.search-switcher-dropdown .dropdown-search-engines');
        if (!cloneEc) return enginesContainer;
        const primaryItems = Array.from(enginesContainer.children).filter(
            (c) => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
        );
        const primaryVisible =
            primaryItems.length > 0 &&
            primaryItems.some((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 2 && r.height > 2;
            });
        if (primaryVisible) return enginesContainer;
        const cloneItems = Array.from(cloneEc.children).filter(
            (c) => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
        );
        const cloneVisible =
            cloneItems.length > 0 &&
            cloneItems.some((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 2 && r.height > 2;
            });
        return cloneVisible ? cloneEc : enginesContainer;
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

    function isSearchEngineRowRenderedVisible(item) {
        if (!item || item.style.display === 'none') return false;
        try {
            if (typeof getComputedStyle === 'undefined') return true;
            return getComputedStyle(item).display !== 'none';
        } catch (_) {
            return true;
        }
    }

    /** Visible allowed engine labels in document order (respects 6/12/50 + `display:none` / CSS-hidden rows). */
    function collectVisibleSwitcherEngineLabels(enginesContainer) {
        if (!enginesContainer) return [];
        const count = getStoredSearchEnginesCount();
        const allowed = new Set(getSearchEngineLabelsForCountMode(count));
        const items = Array.from(enginesContainer.querySelectorAll('.dropdown-item')).filter((c) =>
            c.querySelector('.dropdown-engine-label')
        );
        const visibleLabels = [];
        for (const item of items) {
            const label = getEngineLabel(item);
            if (!allowed.has(label)) continue;
            if (!isSearchEngineRowRenderedVisible(item)) continue;
            visibleLabels.push(label);
        }
        return visibleLabels;
    }

    /** True when visible rows are already case-insensitive A–Z (same outcome as “Restore A-Z”). */
    function isEngineListAlphabeticalVisibleOrder(enginesContainer) {
        const visibleLabels = collectVisibleSwitcherEngineLabels(enginesContainer);
        if (visibleLabels.length === 0) return true;
        const sorted = [...visibleLabels].sort(compareEngineLabelsAlphabetically);
        return visibleLabels.length === sorted.length && visibleLabels.every((l, i) => l === sorted[i]);
    }

    /** True when visible engine rows match the prototype default order for the current count mode (6 / 12 / 50). */
    function isEngineListInDefaultOrder(enginesContainer) {
        if (!enginesContainer) return true;
        const count = getStoredSearchEnginesCount();
        const expected = getDefaultVisibleSearchEngineOrder(count);
        const visibleLabels = collectVisibleSwitcherEngineLabels(enginesContainer);
        if (visibleLabels.length === 0) return true;
        if (visibleLabels.length !== expected.length) return false;
        return visibleLabels.every((l, i) => l === expected[i]);
    }

    /** Hide “Restore A-Z” when A–Z already, or when still on shipped default order (whichever applies). */
    function isRestoreSearchEngineOrderUnneeded(enginesContainer) {
        return (
            isEngineListAlphabeticalVisibleOrder(enginesContainer) || isEngineListInDefaultOrder(enginesContainer)
        );
    }

    const resetSearchEnginesOrderToAlphabetical = () => {
        const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        if (!enginesContainer) return;
        /* Reorder delivers childList mutations → debounced re-clone; cancel so one explicit refresh below wins (avoids stacked re-clones breaking ••• / hover). */
        if (pinnedRightMutationDebounce) {
            clearTimeout(pinnedRightMutationDebounce);
            pinnedRightMutationDebounce = null;
        }
        const sortSection = enginesContainer.querySelector('.engines-sort-section');
        const items = Array.from(enginesContainer.children).filter(
            (c) => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
        );
        if (!items.length) return;
        const sorted = [...items].sort((a, b) =>
            compareEngineLabelsAlphabetically(getEngineLabel(a), getEngineLabel(b))
        );
        const before = sortSection || null;
        sorted.forEach((item) => enginesContainer.insertBefore(item, before));
        const order = sorted.map((item) => getEngineLabel(item));
        if (order.length) {
            try {
                getSearchEngineOrderStorage().setItem(SEARCH_ENGINE_ORDER_KEY, JSON.stringify(order));
            } catch (_) {}
        }
        updateReorderResetButtonState();
        updateKeyboardNumbers();
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const smooth = !document.body.classList.contains('reduced-motion');
                enginesContainer.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
                const scrollParent = enginesContainer.closest('.dropdown-engines-firefox-scroll');
                if (scrollParent) {
                    scrollParent.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
                }
            });
        });
        try {
            if (
                document.body.classList.contains('search-engine-list-mode-pinned-right') &&
                searchContainer?.classList.contains('focused')
            ) {
                requestAnimationFrame(() => {
                    try {
                        refreshPinnedRightSwitcherPanel();
                    } catch (_) {}
                });
            }
        } catch (_) {}
    };

    const RESTORE_AZ_STICKY_SLIDE_MS = 320;

    function cancelRestoreAzStickyPendingClose(sticky) {
        if (!(sticky instanceof Element)) return;
        const c = sticky._restoreAzCloseCleanup;
        if (typeof c === 'function') {
            try {
                c();
            } catch (_) {}
            sticky._restoreAzCloseCleanup = null;
        }
    }

    function getSearchEnginesResetOrderButtonEl() {
        return (
            document.getElementById('search-engines-reset-order-button') ||
            document.getElementById('ab-search-engines-reset-order-button')
        );
    }

    function updateReorderResetButtonState() {
        const enginesPrimary = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        const primaryRestoreUnneeded = isRestoreSearchEngineOrderUnneeded(enginesPrimary);

        const btn = getSearchEnginesResetOrderButtonEl();
        if (btn) {
            if (primaryRestoreUnneeded) {
                btn.setAttribute('hidden', '');
                btn.disabled = true;
            } else {
                btn.removeAttribute('hidden');
                btn.disabled = false;
            }
        }

        const chipEngineListVisible = !!searchSwitcherButton?.classList.contains('open');
        const pinnedRightEngineListVisible =
            document.body.classList.contains('search-engine-list-mode-pinned-right') &&
            !!pinnedRightHost &&
            !pinnedRightHost.hidden &&
            !!searchContainer?.classList.contains('focused');

        const syncRestoreSticky = (enginesContainer, listVisible) => {
            const scrollWrap = enginesContainer?.closest('.dropdown-engines-firefox-scroll');
            const sticky = scrollWrap?.querySelector('.dropdown-restore-az-sticky');
            if (!sticky) return;
            cancelRestoreAzStickyPendingClose(sticky);
            const restoreUnneeded = isRestoreSearchEngineOrderUnneeded(enginesContainer);
            const wantRevealed = !!listVisible && !restoreUnneeded;
            const isRevealed = sticky.classList.contains('dropdown-restore-az-sticky--revealed');
            const sb = sticky.querySelector('.search-engines-restore-az-sticky-button');
            const rm = document.body.classList.contains('reduced-motion');

            if (wantRevealed === isRevealed) {
                if (sb) sb.disabled = !wantRevealed;
                sticky.setAttribute('aria-hidden', wantRevealed ? 'false' : 'true');
                if (!wantRevealed) sticky.setAttribute('hidden', '');
                else sticky.removeAttribute('hidden');
                return;
            }

            if (wantRevealed) {
                sticky.removeAttribute('hidden');
                sticky.setAttribute('aria-hidden', 'false');
                if (sb) sb.disabled = false;
                requestAnimationFrame(() => {
                    void sticky.offsetHeight;
                    sticky.classList.add('dropdown-restore-az-sticky--revealed');
                });
                return;
            }

            if (sb) sb.disabled = true;
            sticky.setAttribute('aria-hidden', 'true');
            sticky.classList.remove('dropdown-restore-az-sticky--revealed');
            if (rm) {
                sticky.setAttribute('hidden', '');
                return;
            }
            let settled = false;
            const settle = () => {
                if (settled) return;
                settled = true;
                sticky.removeEventListener('transitionend', onEnd);
                clearTimeout(fallbackTimer);
                sticky._restoreAzCloseCleanup = null;
            };
            const finishClose = () => {
                settle();
                sticky.setAttribute('hidden', '');
            };
            const onEnd = (ev) => {
                if (ev.target !== sticky || ev.propertyName !== 'grid-template-rows') return;
                finishClose();
            };
            sticky.addEventListener('transitionend', onEnd);
            const fallbackTimer = setTimeout(finishClose, RESTORE_AZ_STICKY_SLIDE_MS + 100);
            sticky._restoreAzCloseCleanup = settle;
        };

        syncRestoreSticky(enginesPrimary, chipEngineListVisible);
        const enginesPinned = pinnedRightHost?.querySelector('.search-switcher-dropdown .dropdown-search-engines');
        syncRestoreSticky(enginesPinned, pinnedRightEngineListVisible);
    }

    if (searchSwitcherButton && typeof MutationObserver !== 'undefined') {
        let restoreAzStickyRaf = null;
        const scheduleRestoreAzStickyFromListVisibility = () => {
            if (restoreAzStickyRaf != null) cancelAnimationFrame(restoreAzStickyRaf);
            restoreAzStickyRaf = requestAnimationFrame(() => {
                restoreAzStickyRaf = null;
                try {
                    updateReorderResetButtonState();
                } catch (_) {}
            });
        };
        new MutationObserver(scheduleRestoreAzStickyFromListVisibility).observe(searchSwitcherButton, {
            attributes: true,
            attributeFilter: ['class'],
        });
        if (searchContainer) {
            new MutationObserver(scheduleRestoreAzStickyFromListVisibility).observe(searchContainer, {
                attributes: true,
                attributeFilter: ['class'],
            });
        }
        if (pinnedRightHost) {
            new MutationObserver(scheduleRestoreAzStickyFromListVisibility).observe(pinnedRightHost, {
                attributes: true,
                attributeFilter: ['hidden'],
            });
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

    /** Pinned-right clone: draggable only when that panel’s reorder UI is active (not when ••• is open on the chip only). */
    function syncPinnedDefaultBadgeDraggableState() {
        const badge = pinnedRightHost?.querySelector('.dropdown-default-badge');
        if (!badge) return;
        const open = !!pinnedRightHost?.classList.contains('search-switcher-reorder-ui-open');
        badge.classList.toggle('dropdown-default-badge--draggable', open);
        if (open) {
            badge.setAttribute('title', 'Drag to move default search engine');
            badge.setAttribute('aria-label', 'Default search engine — drag to move');
        } else {
            badge.setAttribute('title', 'Default search engine');
            badge.setAttribute('aria-label', 'Default search engine');
        }
    }

    /** True when the pinned-right clone’s lilac controls strip is visible (ids stripped; class matches primary). */
    function isPinnedCloneControlsPanelOpen() {
        if (!document.body.classList.contains('search-engine-list-mode-pinned-right')) return false;
        if (!pinnedRightHost || pinnedRightHost.hidden) return false;
        const dd = pinnedRightHost.querySelector('.search-switcher-dropdown');
        if (!dd) return false;
        const ctl = dd.querySelector('.dropdown-search-controls');
        return !!(ctl && !ctl.hasAttribute('hidden'));
    }

    function syncEngineDragHandlesForControlsPanel() {
        const panel = document.getElementById('search-engines-controls-panel');
        const controlsPanelOpenPrimary = !!(panel && !panel.hasAttribute('hidden'));
        const controlsPanelOpenPinned = isPinnedCloneControlsPanelOpen();
        const overflowOpenPrimary = !!searchSwitcherButton?.querySelector(
            '.search-switcher-dropdown .dropdown-label.dropdown-label--overflow-tools-open'
        );
        const overflowOpenPinned = !!pinnedRightHost?.querySelector(
            '.dropdown-label.dropdown-label--overflow-tools-open'
        );
        const openPrimary = controlsPanelOpenPrimary || overflowOpenPrimary;
        const openPinned = controlsPanelOpenPinned || overflowOpenPinned;
        const dropdownForLock = searchSwitcherButton?.querySelector('.search-switcher-dropdown');
        const wasReorderUiOpen = searchSwitcherButton?.classList.contains('search-engines-controls-open');
        /* Lock width before row handles + default-badge drag UI widen scrollWidth (••• / controls edit mode). */
        if (openPrimary && !wasReorderUiOpen && searchSwitcherButton?.classList.contains('open') && dropdownForLock) {
            try {
                syncSearchSwitcherDropdownWidth();
                const w =
                    parseFloat(String(dropdownForLock.style.width).replace(/px$/i, '')) ||
                    dropdownForLock.getBoundingClientRect().width;
                if (w > 0) dropdownForLock.dataset.switcherReorderWidthLock = String(Math.round(w));
            } catch (_) {}
        }
        if (!openPrimary && wasReorderUiOpen && dropdownForLock) {
            delete dropdownForLock.dataset.switcherReorderWidthLock;
        }
        if (searchSwitcherButton) {
            /* Reorder drag listener on *primary* `.dropdown-search-engines` gates on this class; clone-only •••
             * must still set it so forwarded mousedown can start a drag from the pinned duplicate. */
            searchSwitcherButton.classList.toggle('search-engines-controls-open', openPrimary || openPinned);
            /* Overflow-only (chip): show row/badge drag affordances immediately (no lilac panel slide). */
            if (overflowOpenPrimary && !controlsPanelOpenPrimary) {
                searchSwitcherButton.classList.add('search-engines-controls-panel-revealed');
            } else if (!overflowOpenPrimary && !controlsPanelOpenPrimary) {
                searchSwitcherButton.classList.remove('search-engines-controls-panel-revealed');
            }
        }
        if (pinnedRightHost) {
            pinnedRightHost.classList.toggle('search-switcher-reorder-ui-open', openPinned);
            const handlesRevealedPinned = overflowOpenPinned && !controlsPanelOpenPinned;
            pinnedRightHost.classList.toggle('search-switcher-reorder-handles-revealed', handlesRevealedPinned);
        }
        const applyDragHandlesToEnginesContainer = (enginesContainer, open) => {
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
        };
        applyDragHandlesToEnginesContainer(
            searchSwitcherButton?.querySelector('.dropdown-search-engines'),
            openPrimary
        );
        applyDragHandlesToEnginesContainer(
            pinnedRightHost?.querySelector('.search-switcher-dropdown .dropdown-search-engines'),
            openPinned
        );
        syncDefaultBadgeDraggableState();
        syncPinnedDefaultBadgeDraggableState();
        try {
            updateReorderResetButtonState();
        } catch (_) {}
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
    function applyListModeWidthCapFromGridSnapshot(dropdown, cappedPx, shortcutsOpen) {
        if (shortcutsOpen) return cappedPx;
        if (dropdown?.classList.contains('search-engines-display-grid')) return cappedPx;
        const gridLock = dropdown.dataset.switcherGridModeWidthLock;
        if (!gridLock) return cappedPx;
        const g = parseFloat(gridLock);
        if (!(g > 0)) return cappedPx;
        return Math.min(cappedPx, g);
    }

    function recordGridModeWidthSnapshot(dropdown, appliedPx, shortcutsOpen) {
        if (shortcutsOpen) return;
        if (dropdown?.classList.contains('search-engines-display-grid') && appliedPx > 0) {
            dropdown.dataset.switcherGridModeWidthLock = String(Math.round(appliedPx));
        }
    }

    function syncSearchSwitcherDropdownWidth() {
        const btn = document.querySelector('.search-switcher-button');
        const dropdown = btn?.querySelector('.search-switcher-dropdown');
        const infoShell = dropdown?.querySelector('.dropdown-search-info-shell');
        const infoPanel = document.getElementById('search-switcher-info-panel');
        const shortcutsOpen = !!(infoPanel && !infoPanel.hasAttribute('hidden'));
        if (!dropdown) {
            syncPinnedRightDropdownWidthFromPrimary(null);
            return;
        }
        if (!btn?.classList.contains('open')) {
            delete dropdown.dataset.switcherReorderWidthLock;
            delete dropdown.dataset.switcherGridModeWidthLock;
            // Keep fixed px width until max-height collapse finishes; clearing here makes width:auto
            // reflow to a narrower intrinsic width while height still animates (iframes especially).
            if (document.body.classList.contains('reduced-motion')) {
                dropdown.style.width = '';
            }
            syncPinnedRightDropdownWidthFromPrimary(dropdown);
            return;
        }
        const lockRaw = dropdown.dataset.switcherReorderWidthLock;
        if (lockRaw && (!infoPanel || infoPanel.hasAttribute('hidden'))) {
            const lockW = parseFloat(lockRaw);
            if (lockW > 0) {
                const clamped = Math.min(Math.max(lockW, 200), window.innerWidth - 24);
                dropdown.style.width = `${clamped}px`;
                syncPinnedRightDropdownWidthFromPrimary(dropdown);
                try {
                    scheduleListEngineLabelTooltipSync();
                } catch (_) {}
                return;
            }
        }
        if (!infoShell) {
            void dropdown.offsetWidth;
            let w = Math.min(Math.max(dropdown.scrollWidth, 200), window.innerWidth - 24);
            w = applyListModeWidthCapFromGridSnapshot(dropdown, w, false);
            dropdown.style.width = `${w}px`;
            recordGridModeWidthSnapshot(dropdown, w, false);
            syncPinnedRightDropdownWidthFromPrimary(dropdown);
            try {
                scheduleListEngineLabelTooltipSync();
            } catch (_) {}
            return;
        }
        // While Shortcuts is open or closing, never `display:none` the info shell — that kills the slide transition.
        // Keep width at least the previous px width so the menu does not shrink to the shortcuts column.
        if (infoPanel && !infoPanel.hasAttribute('hidden')) {
            void dropdown.offsetWidth;
            const measured = dropdown.scrollWidth;
            const capped = Math.min(Math.max(measured, 200), window.innerWidth - 24);
            const currentPx = parseFloat(String(dropdown.style.width).replace(/px$/i, '')) || 0;
            let finalW = Math.max(capped, currentPx);
            finalW = applyListModeWidthCapFromGridSnapshot(dropdown, finalW, shortcutsOpen);
            dropdown.style.width = `${finalW}px`;
            recordGridModeWidthSnapshot(dropdown, finalW, shortcutsOpen);
            syncPinnedRightDropdownWidthFromPrimary(dropdown);
            try {
                scheduleListEngineLabelTooltipSync();
            } catch (_) {}
            return;
        }
        const prevDisplay = infoShell.style.display;
        infoShell.style.display = 'none';
        void dropdown.offsetWidth;
        const measured = dropdown.scrollWidth;
        infoShell.style.display = prevDisplay;
        void dropdown.offsetWidth;
        let capped = Math.min(Math.max(measured, 200), window.innerWidth - 24);
        capped = applyListModeWidthCapFromGridSnapshot(dropdown, capped, shortcutsOpen);
        dropdown.style.width = `${capped}px`;
        recordGridModeWidthSnapshot(dropdown, capped, shortcutsOpen);
        syncPinnedRightDropdownWidthFromPrimary(dropdown);
        try {
            scheduleListEngineLabelTooltipSync();
        } catch (_) {}
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

    let pinnedRightMutationObserver = null;
    let pinnedRightMutationDebounce = null;
    /** Set when list/grid display toggles are wired (same behavior as chip dropdown, without opening it). */
    let flipSearchEnginesDisplayModeForPinned = null;

    function sanitizePinnedRightCloneRoot(root) {
        if (!root) return;
        // Primary dropdown is inert while the chip is closed; the clone must stay interactive.
        root.removeAttribute('inert');
        root.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
        root.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
        root.querySelectorAll('[for]').forEach((el) => el.removeAttribute('for'));
        root.querySelectorAll('[data-search-engines-display-toggle]').forEach((el) => {
            el.setAttribute('data-search-engines-display-toggle', SEARCH_ENGINES_DISPLAY_SURFACE_PINNED);
        });
        root.querySelectorAll('.dropdown-default-badge').forEach((badge) => {
            badge.classList.remove('dropdown-default-badge--draggable', 'dropdown-default-badge--dragging');
        });
        /* Ephemeral reorder UI from the primary surface must not appear in the pinned clone. */
        root.querySelectorAll('.dropdown-drop-marker').forEach((el) => el.remove());
    }

    /**
     * Width for the pinned-right clone only: engines + From Firefox, with blue/lilac subpanels
     * treated as collapsed so opening them does not widen the pinned column (unlike the chip menu).
     */
    function measurePinnedDropdownBaseWidth(sourceDropdown) {
        if (!sourceDropdown) return 200;
        const probe = sourceDropdown.cloneNode(true);
        probe.classList.add('search-switcher-dropdown--width-probe');
        probe.style.cssText =
            'position:fixed;left:-9999px;top:0;visibility:hidden;pointer-events:none;max-height:none!important;overflow:visible!important;display:flex;flex-direction:column;';
        const clip = probe.querySelector('.dropdown-switcher-subpanels-clip');
        if (clip) {
            clip.classList.remove('dropdown-switcher-subpanels-clip--open');
        }
        const ctrls = probe.querySelector('#search-engines-controls-panel');
        if (ctrls) {
            ctrls.setAttribute('hidden', '');
        }
        const infoPanel = probe.querySelector('#search-switcher-info-panel');
        if (infoPanel) {
            infoPanel.setAttribute('hidden', '');
        }
        const infoShell = probe.querySelector('.dropdown-search-info-shell');
        if (infoShell && infoPanel?.hasAttribute('hidden')) {
            infoShell.style.display = 'none';
        }
        document.body.appendChild(probe);
        void probe.offsetWidth;
        const w = Math.min(Math.max(probe.scrollWidth, 200), window.innerWidth - 24);
        document.body.removeChild(probe);
        return w;
    }

    function syncPinnedRightPanelLayoutAfterAppend(cloneDd) {
        if (!cloneDd) return;
        const rect = cloneDd.getBoundingClientRect();
        const bottomPadding = 8;
        const available = Math.floor(window.innerHeight - rect.top - bottomPadding);
        cloneDd.style.setProperty('--switcher-dropdown-max-height', `${Math.max(160, available)}px`);
    }

    function syncPinnedRightDropdownWidthFromPrimary(primaryDropdown) {
        try {
            if (!pinnedRightHost || pinnedRightHost.hidden) return;
            if (!document.body.classList.contains('search-engine-list-mode-pinned-right')) return;
            const cloneDd = pinnedRightHost.querySelector('.search-switcher-dropdown');
            if (!cloneDd || !primaryDropdown) return;
            const lock = primaryDropdown.dataset.switcherReorderWidthLock;
            const inlineW = parseFloat(String(primaryDropdown.style.width).replace(/px$/i, '')) || 0;
            const chipSwitcherOpen = searchSwitcherButton?.classList.contains('open');
            if (lock) {
                const lockW = parseFloat(lock);
                if (lockW > 0) {
                    const useW = Math.max(lockW, inlineW);
                    cloneDd.style.width = `${Math.min(Math.max(useW, 200), window.innerWidth - 24)}px`;
                    return;
                }
            }
            /* While the chip menu is open, do not mirror its live scrollWidth — it shifts as max-height
             * finishes and is wider than the pinned column’s collapsed probe (see measurePinnedDropdownBaseWidth). */
            if (!chipSwitcherOpen && inlineW > 0) {
                cloneDd.style.width = `${Math.min(Math.max(inlineW, 200), window.innerWidth - 24)}px`;
                return;
            }
            cloneDd.style.width = `${measurePinnedDropdownBaseWidth(primaryDropdown)}px`;
        } catch (_) {}
    }

    function getPrimaryEngineRowByLabel(label) {
        if (!label) return null;
        const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        if (!enginesContainer) return null;
        return Array.from(enginesContainer.querySelectorAll('.dropdown-item')).find(
            (r) => getEngineLabel(r) === label
        );
    }

    /** Label pin: reflects "Pinned right" in This menu (search_engine_list_mode); not pin-default SE mode. */
    function syncSearchSwitcherPanelPinToggle() {
        let mode = 'closed';
        try {
            mode = getSearchEngineListMode();
        } catch (_) {}
        const pinnedRight = mode === 'pinned-right';
        document.querySelectorAll('.search-engines-pin-default-toggle').forEach((btn) => {
            btn.setAttribute('aria-pressed', pinnedRight ? 'true' : 'false');
            btn.setAttribute(
                'title',
                pinnedRight ? 'Unpin panel' : 'Pin the search engines open while searching'
            );
        });
    }

    function finishDropdownLabelOverflowToolsClose(labelEl) {
        if (!labelEl) return;
        labelEl.classList.remove('dropdown-label--overflow-tools-closing');
        requestAnimationFrame(() => {
            try {
                syncSearchSwitcherDropdownWidth();
                syncEngineDragHandlesForControlsPanel();
            } catch (_) {}
        });
    }

    function setDropdownLabelOverflowToolsOpen(labelEl, open, options) {
        if (!labelEl) return;
        const immediate = options?.immediate === true;
        const btn = labelEl.querySelector('.search-switcher-more-menu-button');
        const reveal = labelEl.querySelector('.dropdown-label-overflow-reveal');

        if (open) {
            labelEl.classList.remove('dropdown-label--overflow-tools-closing');
            labelEl.classList.add('dropdown-label--overflow-tools-open');
            if (btn) {
                btn.setAttribute('aria-expanded', 'true');
                btn.setAttribute('title', 'Hide toolbar');
                btn.setAttribute('aria-label', 'Hide toolbar');
            }
            if (reveal) reveal.setAttribute('aria-hidden', 'false');
            try {
                syncEngineDragHandlesForControlsPanel();
            } catch (_) {}
            requestAnimationFrame(() => {
                try {
                    syncSearchSwitcherDropdownWidth();
                } catch (_) {}
            });
            return;
        }

        if (immediate) {
            labelEl.classList.remove(
                'dropdown-label--overflow-tools-open',
                'dropdown-label--overflow-tools-closing'
            );
            if (btn) {
                btn.setAttribute('aria-expanded', 'false');
                btn.setAttribute('title', 'Show toolbar');
                btn.setAttribute('aria-label', 'Show toolbar');
            }
            if (reveal) reveal.setAttribute('aria-hidden', 'true');
            try {
                syncEngineDragHandlesForControlsPanel();
            } catch (_) {}
            requestAnimationFrame(() => {
                try {
                    syncSearchSwitcherDropdownWidth();
                } catch (_) {}
            });
            return;
        }

        if (!labelEl.classList.contains('dropdown-label--overflow-tools-open')) return;

        /* Apply closing layout before aria-expanded flips so CSS can keep ••• from flashing (icon/background). */
        labelEl.classList.add('dropdown-label--overflow-tools-closing');
        labelEl.classList.remove('dropdown-label--overflow-tools-open');

        if (btn) {
            btn.setAttribute('aria-expanded', 'false');
            btn.setAttribute('title', 'Show toolbar');
            btn.setAttribute('aria-label', 'Show toolbar');
        }
        if (reveal) reveal.setAttribute('aria-hidden', 'true');
        try {
            syncEngineDragHandlesForControlsPanel();
        } catch (_) {}

        const rm = document.body.classList.contains('reduced-motion');
        let done = false;
        let fallbackTimer = null;
        const finishOnce = () => {
            if (done) return;
            done = true;
            if (reveal) reveal.removeEventListener('transitionend', onRevealEnd);
            if (fallbackTimer !== null) clearTimeout(fallbackTimer);
            finishDropdownLabelOverflowToolsClose(labelEl);
        };
        const onRevealEnd = (e) => {
            if (e.target !== reveal || e.propertyName !== 'max-width') return;
            finishOnce();
        };
        if (reveal) {
            reveal.addEventListener('transitionend', onRevealEnd);
            fallbackTimer = setTimeout(finishOnce, rm ? 0 : 450);
        } else {
            setTimeout(finishOnce, 0);
        }
        requestAnimationFrame(() => {
            try {
                syncSearchSwitcherDropdownWidth();
            } catch (_) {}
        });
    }

    function toggleDropdownLabelOverflowTools(moreBtn) {
        const label = moreBtn?.closest('.dropdown-label');
        if (!label) return;
        if (label.classList.contains('dropdown-label--overflow-tools-closing')) return;
        const next = !label.classList.contains('dropdown-label--overflow-tools-open');
        setDropdownLabelOverflowToolsOpen(label, next);
    }

    function closeAllDropdownLabelOverflowTools() {
        document
            .querySelectorAll('.dropdown-label--overflow-tools-open, .dropdown-label--overflow-tools-closing')
            .forEach((label) => {
                setDropdownLabelOverflowToolsOpen(label, false, { immediate: true });
            });
    }

    function isSearchSwitcherControlsVisibleByDefault() {
        return true;
    }

    function applySearchSwitcherControlsVisibleLayout() {
        const expanded = isSearchSwitcherControlsVisibleByDefault();
        document.body.classList.toggle('search-switcher-label-compact', !expanded);
        document.body.classList.toggle('search-switcher-label-controls-expanded', expanded);
        document.querySelectorAll('.search-engines-display-segmented--in-controls-panel').forEach((el) => {
            el.toggleAttribute('hidden', expanded);
        });
        const controlsPanel = document.getElementById('search-engines-controls-panel');
        document.querySelectorAll('.search-engines-controls-toggle').forEach((controlsBtn) => {
            const controlsImg = controlsBtn.querySelector('.search-engines-controls-toggle-icon');
            if (!controlsImg) return;
            if (expanded) {
                controlsImg.setAttribute('src', 'icons/settings.svg');
                controlsBtn.setAttribute('title', 'Search settings');
                controlsBtn.setAttribute('aria-controls', 'search-settings-modal');
                controlsBtn.removeAttribute('aria-expanded');
            } else {
                controlsImg.setAttribute('src', 'icons/controls.svg');
                controlsBtn.setAttribute('title', 'Controls');
                controlsBtn.setAttribute('aria-controls', 'search-engines-controls-panel');
                const open = controlsPanel && !controlsPanel.hasAttribute('hidden');
                controlsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
            }
        });
        syncSearchSwitcherPanelPinToggle();
        requestAnimationFrame(() => {
            syncSearchSwitcherDropdownWidth();
            if (document.body.classList.contains('search-engine-list-mode-pinned-right') && searchContainer?.classList.contains('focused')) {
                refreshPinnedRightSwitcherPanel();
            }
        });
    }

    applySearchSwitcherControlsVisibleLayout();
    applySearchEnginesDisplayMode(undefined, 'all');

    /** Set false to silence `[pinned-right-panel]` console logs. */
    const DEBUG_PINNED_RIGHT_PANEL_CLICKS = false;
    const logPinnedPanel = (...args) => {
        if (DEBUG_PINNED_RIGHT_PANEL_CLICKS) console.log('[pinned-right-panel]', ...args);
    };

    /**
     * Firefox can report `click`/`mousedown` `event.target` as `.search-switcher-pinned-right-host`
     * while `document.elementFromPoint` still returns the real control. `closest()` from the host
     * never finds descendants, so we resolve the effective node for pinned forwarding.
     */
    function pinnedRightPanelHitFromEvent(e) {
        if (!pinnedRightHost || pinnedRightHost.hidden) return null;
        let hit = null;
        try {
            hit = document.elementFromPoint(e.clientX, e.clientY);
        } catch (_) {}
        if (hit instanceof Element && pinnedRightHost.contains(hit)) return hit;
        if (e.target instanceof Element && pinnedRightHost.contains(e.target)) return e.target;
        return null;
    }

    /**
     * Run the same actions as the chip dropdown for engines/settings rows (primary DOM).
     * (i) / controls toggles only affect the pinned clone (`togglePinnedRightClone*`).
     */
    function handlePinnedRightPanelInteraction(tgt, e) {
        const primaryDropdown = searchSwitcherButton?.querySelector('.search-switcher-dropdown');
        if (!primaryDropdown || !pinnedRightHost?.contains(tgt)) {
            logPinnedPanel('handle: bail (no primary dropdown or target outside host)', {
                hasPrimaryDropdown: !!primaryDropdown,
                containsTarget: pinnedRightHost ? pinnedRightHost.contains(tgt) : null,
                targetTag: tgt?.nodeName,
            });
            return false;
        }

        if (tgt.closest('.search-engine-list-mode-select')) {
            logPinnedPanel('handle: list-mode <select> — native handling (return false)');
            return false;
        }

        const segBtn = tgt.closest('.search-engines-display-segment[data-mode]');
        if (segBtn) {
            logPinnedPanel('handle: list/grid segment', {
                mode: segBtn.getAttribute('data-mode'),
                flipFn: typeof flipSearchEnginesDisplayModeForPinned,
            });
            if (flipSearchEnginesDisplayModeForPinned) flipSearchEnginesDisplayModeForPinned();
            return true;
        }

        if (tgt.closest('.search-engines-pin-default-toggle')) {
            logPinnedPanel('handle: pin-default toggle');
            toggleSearchSwitcherPanelPin();
            return true;
        }

        if (tgt.closest('.search-engines-controls-toggle')) {
            logPinnedPanel('handle: controls toggle', { defaultVisible: isSearchSwitcherControlsVisibleByDefault() });
            if (isSearchSwitcherControlsVisibleByDefault()) {
                document.getElementById('more-search-settings-button')?.click();
            } else {
                togglePinnedRightCloneControlsPanel();
            }
            return true;
        }
        if (tgt.closest('.dropdown-label-info-icon')) {
            logPinnedPanel('handle: (i) info toggle');
            togglePinnedRightCloneInfoPanel();
            return true;
        }
        if (tgt.closest('.search-engines-reset-order-button')) {
            logPinnedPanel('handle: reset order');
            const btn =
                document.getElementById('search-engines-reset-order-button') ||
                document.getElementById('ab-search-engines-reset-order-button');
            if (btn && !btn.hasAttribute('hidden')) {
                btn.click();
            }
            return true;
        }
        if (tgt.closest('.more-search-settings-button')) {
            logPinnedPanel('handle: more search settings');
            document.getElementById('more-search-settings-button')?.click();
            return true;
        }
        if (tgt.closest('.search-switcher-more-menu-button')) {
            logPinnedPanel('handle: ••• overflow menu');
            const mb = tgt.closest('.search-switcher-more-menu-button');
            if (mb) toggleDropdownLabelOverflowTools(mb);
            return true;
        }

        const firefoxToggle = tgt.closest('.dropdown-firefox-toggle');
        if (firefoxToggle) {
            logPinnedPanel('handle: Firefox suggestion checkbox');
            toggleFirefoxSuggestionCheckbox(firefoxToggle);
            restoreFirefoxSuggestionsState();
            return true;
        }

        const openNewTabBtn = tgt.closest('.dropdown-item-open-new-window');
        if (openNewTabBtn) {
            logPinnedPanel('handle: open in new tab row');
            const row = openNewTabBtn.closest('.dropdown-item');
            const label = row ? getEngineLabel(row) : '';
            const query = (searchInput?.value || '').trim();
            if (label && query) {
                runSearchWithEngine(query, label, false);
            }
            switcherHighlightedIndex = -1;
            searchSwitcherButton?.querySelectorAll('.dropdown-item').forEach((i) => i.classList.remove('highlighted'));
            if (searchContainer?.classList.contains('focused')) restoreFocusAndOpaqueSuggestions();
            return true;
        }

        const item = tgt.closest('.dropdown-item');
        if (item) {
            if (item.id === 'quick-buttons-toggle') {
                logPinnedPanel('handle: quick-buttons-toggle ignored');
                return false;
            }
            if (item.closest('.dropdown-item-firefox-suggestion') && !tgt.closest('.dropdown-firefox-toggle')) {
                logPinnedPanel('handle: firefox suggestion row (not toggle) — ignored');
                return false;
            }
            const query = (searchInput?.value || '').trim();
            const isEngineItem = !!item.querySelector('.dropdown-engine-label');
            const label = getEngineLabel(item);
            let primaryRow = label ? getPrimaryEngineRowByLabel(label) : null;
            if (!primaryRow && item.classList.contains('dropdown-item-pinned')) {
                primaryRow = primaryDropdown.querySelector('.dropdown-item-pinned');
            }
            if (!primaryRow) {
                logPinnedPanel('handle: dropdown-item but no primaryRow', { label, isEngineItem });
                return false;
            }
            const openInBackground = e && (e.metaKey || e.ctrlKey) && isEngineItem && !!query;
            if (openInBackground) {
                logPinnedPanel('handle: engine search background tab', { label: getEngineLabel(primaryRow), query });
                runSearchWithEngine(query, getEngineLabel(primaryRow), false);
            } else {
                logPinnedPanel('handle: engine row', {
                    label: getEngineLabel(primaryRow),
                    query,
                    applySource: true,
                    runSearch: !!(isEngineItem && query),
                });
                applySelectedSearchSource(primaryRow);
                if (isEngineItem && query) {
                    runSearchWithEngine(query, getEngineLabel(primaryRow), true);
                }
            }
            switcherHighlightedIndex = -1;
            searchSwitcherButton?.querySelectorAll('.dropdown-item').forEach((i) => i.classList.remove('highlighted'));
            if (searchContainer?.classList.contains('focused')) {
                restoreFocusAndOpaqueSuggestions();
            }
            return true;
        }
        logPinnedPanel('handle: no matching branch (return false)');
        return false;
    }

    function onPinnedRightHostClickCapture(e) {
        if (!pinnedRightHost || pinnedRightHost.hidden) return;
        if (!document.body.classList.contains('search-engine-list-mode-pinned-right')) {
            logPinnedPanel('click capture: skip (not pinned-right mode)');
            return;
        }
        /* Trailing click after engine reorder ends does not bubble through the chip’s `.search-switcher-dropdown`. */
        if (window._searchEngineDragOccurred) {
            window._searchEngineDragOccurred = false;
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        const hitEl = pinnedRightPanelHitFromEvent(e);
        if (!hitEl) return;
        let topHit = null;
        try {
            topHit = document.elementFromPoint(e.clientX, e.clientY);
        } catch (_) {}
        logPinnedPanel('click capture', {
            target: e.target?.nodeName,
            targetClass: typeof e.target?.className === 'string' ? e.target.className : '',
            topHit: topHit?.nodeName,
            topHitClass: typeof topHit?.className === 'string' ? topHit.className : '',
            targetVsTopHit: e.target !== topHit,
        });
        const interactive = hitEl.closest(
            'button, [role="button"], [role="checkbox"], .dropdown-item, .dropdown-firefox-toggle, select, .search-engines-display-segment[data-mode]'
        );
        if (!interactive || !pinnedRightHost.contains(interactive)) {
            logPinnedPanel('click capture: no interactive match', {
                hasInteractive: !!interactive,
                interactiveInHost: interactive ? pinnedRightHost.contains(interactive) : false,
            });
            return;
        }
        const handled = handlePinnedRightPanelInteraction(hitEl, e);
        logPinnedPanel('click capture: handlePinnedRightPanelInteraction →', handled);
        if (handled) {
            e.preventDefault();
            e.stopPropagation();
            logPinnedPanel('click capture: preventDefault + stopPropagation');
            // (i) / controls / ••• toolbar: clone-only toggles — no refresh here (refresh would reset clone DOM).
            const isSubpanelChromeToggle = hitEl.closest(
                '.search-engines-controls-toggle, .dropdown-label-info-icon, .search-switcher-more-menu-button'
            );
            if (!isSubpanelChromeToggle) {
                logPinnedPanel('click capture: schedule refreshPinnedRightSwitcherPanel');
                requestAnimationFrame(() => refreshPinnedRightSwitcherPanel());
            }
        }
    }

    function onPinnedRightHostChangeCapture(e) {
        if (!pinnedRightHost || pinnedRightHost.hidden) return;
        let tgt = e.target instanceof Element ? e.target : null;
        if (tgt === pinnedRightHost && document.activeElement instanceof Element && pinnedRightHost.contains(document.activeElement)) {
            tgt = document.activeElement;
        }
        if (!tgt || !pinnedRightHost.contains(tgt)) return;
        const sel = tgt.closest('.search-engine-list-mode-select');
        if (!sel) return;
        const primary = document.getElementById('search-engine-list-mode-select');
        if (!primary || sel === primary) return;
        e.stopPropagation();
        logPinnedPanel('change capture: clone list-mode select', { value: sel.value, primaryWas: primary.value });
        if (sel.value !== primary.value) {
            primary.value = sel.value;
            primary.dispatchEvent(new Event('change', { bubbles: true }));
            logPinnedPanel('change capture: synced primary select + dispatched change');
        }
    }

    function onPinnedRightHostMouseDownCapture(e) {
        if (!pinnedRightHost || pinnedRightHost.hidden) return;
        if (!document.body.classList.contains('search-engine-list-mode-pinned-right')) return;
        const hitEl = pinnedRightPanelHitFromEvent(e);
        if (!hitEl) return;
        logPinnedPanel('mousedown capture', { button: e.button, target: e.target?.nodeName });
        if (e.button === 0) {
            pinnedRightHostPointerActive = true;
        }
        const handle = hitEl.closest('.dropdown-item-drag-handle');
        if (handle) {
            if (typeof engineReorderHandlePinnedCloneMousedown === 'function') {
                e.preventDefault();
                e.stopPropagation();
                engineReorderHandlePinnedCloneMousedown(e);
            }
            return;
        }
        const badge = hitEl.closest('.dropdown-default-badge--draggable');
        if (badge) {
            if (typeof handleDefaultBadgeDragMouseDown === 'function') {
                e.preventDefault();
                e.stopPropagation();
                handleDefaultBadgeDragMouseDown(e);
            }
            return;
        }
    }

    /**
     * Avoid full re-clone when primary-only changes cannot affect the pinned duplicate's content
     * (independent blue/lilac state), or when only the chip dropdown width (style) updates.
     */
    function shouldSkipPinnedCloneRefreshForMutations(mutations) {
        const sd = searchSwitcherButton?.querySelector('.search-switcher-dropdown');
        if (!sd || !mutations?.length) return false;
        if (mutations.some((m) => m.type === 'childList')) return false;

        /**
         * `syncSearchSwitcherDropdownWidth` sets inline `style` on the dropdown root and descendants
         * (e.g. `.dropdown-search-info-shell` display toggles during measurement). Those are not
         * structural — only sync pinned width. Skipping full re-clone here stops an observer feedback
         * loop: re-clone → width sync → style mutations → debounced refresh → re-clone → …
         */
        if (
            mutations.every((m) => {
                if (m.type !== 'attributes' || m.attributeName !== 'style') return false;
                const t = m.target;
                return t instanceof Element && sd.contains(t);
            })
        ) {
            syncPinnedRightDropdownWidthFromPrimary(sd);
            return true;
        }

        const isSkippableAttr = (m) => {
            if (m.type !== 'attributes' || !(m.target instanceof Element)) return false;
            const an = m.attributeName;
            const el = m.target;
            /* `updateReorderResetButtonState` syncs this sticky row on primary + clone in the same tick; re-cloning
             * only from a primary `hidden` flip replaces the pinned DOM under the cursor (••• hover flicker, no click). */
            if (an === 'hidden' && el.classList?.contains('dropdown-restore-az-sticky')) {
                return true;
            }
            if (an === 'class' && el.classList?.contains('dropdown-restore-az-sticky')) {
                return true;
            }
            /* Primary-only id; pinned clone has no id — alphabetical restore toggles this without needing another re-clone. */
            if (
                an === 'hidden' &&
                (el.id === 'search-engines-reset-order-button' || el.id === 'ab-search-engines-reset-order-button')
            ) {
                return true;
            }
            if (an === 'hidden' && (el.id === 'search-engines-controls-panel' || el.id === 'search-switcher-info-panel')) {
                return true;
            }
            if (an === 'class' && el.classList?.contains('dropdown-switcher-subpanels-clip')) {
                return true;
            }
            if (
                an === 'aria-expanded' &&
                (el.id === 'search-engines-controls-toggle' || el.id === 'search-switcher-info-toggle')
            ) {
                return true;
            }
            return false;
        };

        return mutations.every((m) => isSkippableAttr(m));
    }

    function ensurePinnedRightMutationObserver() {
        if (pinnedRightMutationObserver || !searchSwitcherButton) return;
        const sd = searchSwitcherButton.querySelector('.search-switcher-dropdown');
        if (!sd) return;
        pinnedRightMutationObserver = new MutationObserver((mutations) => {
            if (
                !document.body.classList.contains('search-engine-list-mode-pinned-right') ||
                !searchContainer?.classList.contains('focused')
            ) {
                return;
            }
            /* Reorder uses a body-level ghost clone; source row stays in the list (grey placeholder). */
            if (window._searchEngineDragging) return;
            /* Default badge is moved to body + placeholder inserted — same idea: keep clone stable until mouseup. */
            if (window._defaultBadgeDragging) return;
            if (shouldSkipPinnedCloneRefreshForMutations(mutations)) {
                return;
            }
            clearTimeout(pinnedRightMutationDebounce);
            pinnedRightMutationDebounce = setTimeout(() => {
                refreshPinnedRightSwitcherPanel();
            }, 80);
        });
        pinnedRightMutationObserver.observe(sd, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['hidden', 'class', 'style'],
        });
    }

    const PINNED_SUBPANEL_SLIDE_MS = 320;

    function getPinnedCloneSubpanelElements(dd) {
        if (!dd) return null;
        const clip = dd.querySelector('.dropdown-switcher-subpanels-clip');
        const controls = dd.querySelector('.dropdown-search-controls');
        const info = dd.querySelector('.dropdown-search-info-panel');
        const controlsToggle = dd.querySelector('.search-engines-controls-toggle');
        const infoToggle = dd.querySelector('.dropdown-label-info-icon');
        return { dd, clip, controls, info, controlsToggle, infoToggle };
    }

    function syncPinnedCloneSubpanelsClipOpenClass(els) {
        if (!els?.clip) return;
        const controlsOpen = els.controls && !els.controls.hasAttribute('hidden');
        els.clip.classList.toggle(
            'dropdown-switcher-subpanels-clip--open',
            !!controlsOpen
        );
    }

    function clearPinnedCloneFromFirefoxFooterFlipStyles() {
        const footer = pinnedRightHost?.querySelector('.dropdown-from-firefox-footer');
        if (!footer) return;
        footer.style.transition = '';
        footer.style.transform = '';
    }

    function capturePinnedCloneSubpanelState() {
        const els = getPinnedCloneSubpanelElements(pinnedRightHost?.querySelector('.search-switcher-dropdown'));
        if (!els) return null;
        return {
            controlsOpen: !!(els.controls && !els.controls.hasAttribute('hidden')),
            infoOpen: !!(els.info && !els.info.hasAttribute('hidden')),
        };
    }

    /** Whether the pinned-right clone’s label toolbar (••• strip) is open — independent of the chip dropdown. */
    function capturePinnedCloneOverflowToolbarOpen() {
        return !!pinnedRightHost?.querySelector(
            '.dropdown-label.dropdown-label--overflow-tools-open'
        );
    }

    function applyPinnedCloneSubpanelState(cloneRoot, state) {
        if (!cloneRoot || !state) return;
        const els = getPinnedCloneSubpanelElements(cloneRoot);
        if (!els) return;
        if (els.controls) {
            if (state.controlsOpen) els.controls.removeAttribute('hidden');
            else els.controls.setAttribute('hidden', '');
        }
        if (els.info) {
            if (state.infoOpen) els.info.removeAttribute('hidden');
            else els.info.setAttribute('hidden', '');
        }
        syncPinnedCloneSubpanelsClipOpenClass(els);
        els.controlsToggle?.setAttribute('aria-expanded', state.controlsOpen ? 'true' : 'false');
        els.infoToggle?.setAttribute('aria-expanded', state.infoOpen ? 'true' : 'false');
    }

    function togglePinnedRightCloneControlsPanel() {
        const dd = pinnedRightHost?.querySelector('.search-switcher-dropdown');
        const els = getPinnedCloneSubpanelElements(dd);
        if (!els || !els.controls) return;
        if (!els.clip) {
            els.controls.toggleAttribute('hidden');
            const open = !els.controls.hasAttribute('hidden');
            els.controlsToggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
            syncEngineDragHandlesForControlsPanel();
            return;
        }
        const opening = els.controls.hasAttribute('hidden');
        if (opening) {
            const wasInfoOpen = els.info && !els.info.hasAttribute('hidden');
            clearPinnedCloneFromFirefoxFooterFlipStyles();
            if (wasInfoOpen) {
                els.info?.setAttribute('hidden', '');
                els.infoToggle?.setAttribute('aria-expanded', 'false');
                els.controls.removeAttribute('hidden');
                els.controlsToggle?.setAttribute('aria-expanded', 'true');
                els.clip.classList.add('dropdown-switcher-subpanels-clip--open');
                syncPinnedCloneSubpanelsClipOpenClass(els);
                syncEngineDragHandlesForControlsPanel();
                return;
            }
            if (els.info && !els.info.hasAttribute('hidden')) {
                els.info.setAttribute('hidden', '');
                els.infoToggle?.setAttribute('aria-expanded', 'false');
            }
            els.controls.removeAttribute('hidden');
            syncEngineDragHandlesForControlsPanel();
            requestAnimationFrame(() => {
                els.clip.classList.add('dropdown-switcher-subpanels-clip--open');
                syncPinnedCloneSubpanelsClipOpenClass(els);
                const rm = document.body.classList.contains('reduced-motion');
                if (rm) {
                    requestAnimationFrame(() => dd && syncPinnedRightPanelLayoutAfterAppend(dd));
                } else {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => dd && syncPinnedRightPanelLayoutAfterAppend(dd));
                    });
                }
            });
            return;
        }
        els.clip.classList.remove('dropdown-switcher-subpanels-clip--open');
        els.controlsToggle?.setAttribute('aria-expanded', 'false');
        let settled = false;
        const settle = () => {
            if (settled) return;
            settled = true;
            els.clip.removeEventListener('transitionend', onTrEnd);
            clearTimeout(fallbackTimer);
            els.controls.setAttribute('hidden', '');
            syncPinnedCloneSubpanelsClipOpenClass(els);
            if (dd) syncPinnedRightPanelLayoutAfterAppend(dd);
            syncEngineDragHandlesForControlsPanel();
        };
        const onTrEnd = (ev) => {
            if (ev.target !== els.clip || ev.propertyName !== 'grid-template-rows') return;
            settle();
        };
        els.clip.addEventListener('transitionend', onTrEnd);
        const fallbackTimer = setTimeout(
            settle,
            document.body.classList.contains('reduced-motion') ? 0 : PINNED_SUBPANEL_SLIDE_MS + 100
        );
    }

    function togglePinnedRightCloneInfoPanel() {
        const dd = pinnedRightHost?.querySelector('.search-switcher-dropdown');
        const els = getPinnedCloneSubpanelElements(dd);
        if (!els || !els.info) return;
        if (!els.clip) {
            els.info.toggleAttribute('hidden');
            const open = !els.info.hasAttribute('hidden');
            els.infoToggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
            return;
        }
        const opening = els.info.hasAttribute('hidden');
        if (opening) {
            clearPinnedCloneFromFirefoxFooterFlipStyles();
            const wasControlsOpen = els.controls && !els.controls.hasAttribute('hidden');
            if (wasControlsOpen) {
                els.controls.setAttribute('hidden', '');
                els.controlsToggle?.setAttribute('aria-expanded', 'false');
                els.info.removeAttribute('hidden');
                els.infoToggle?.setAttribute('aria-expanded', 'true');
                els.clip.classList.remove('dropdown-switcher-subpanels-clip--open');
                syncPinnedCloneSubpanelsClipOpenClass(els);
                syncEngineDragHandlesForControlsPanel();
                return;
            }
            if (els.controls && !els.controls.hasAttribute('hidden')) {
                els.controls.setAttribute('hidden', '');
                els.controlsToggle?.setAttribute('aria-expanded', 'false');
                syncEngineDragHandlesForControlsPanel();
            }
            els.info.removeAttribute('hidden');
            els.infoToggle?.setAttribute('aria-expanded', 'true');
            requestAnimationFrame(() => syncPinnedRightPanelLayoutAfterAppend(dd));
            requestAnimationFrame(() => requestAnimationFrame(() => syncPinnedRightPanelLayoutAfterAppend(dd)));
            return;
        }
        clearPinnedCloneFromFirefoxFooterFlipStyles();
        const clipWasOpen = els.clip.classList.contains('dropdown-switcher-subpanels-clip--open');
        els.clip.classList.remove('dropdown-switcher-subpanels-clip--open');
        els.infoToggle?.setAttribute('aria-expanded', 'false');
        let settled = false;
        let fallbackTimer = null;
        const settle = () => {
            if (settled) return;
            settled = true;
            els.clip.removeEventListener('transitionend', onTrEnd);
            if (fallbackTimer != null) clearTimeout(fallbackTimer);
            els.info.setAttribute('hidden', '');
            syncPinnedCloneSubpanelsClipOpenClass(els);
            if (dd) syncPinnedRightPanelLayoutAfterAppend(dd);
        };
        const onTrEnd = (ev) => {
            if (ev.target !== els.clip || ev.propertyName !== 'grid-template-rows') return;
            settle();
        };
        if (!clipWasOpen) {
            settle();
            return;
        }
        els.clip.addEventListener('transitionend', onTrEnd);
        fallbackTimer = setTimeout(
            settle,
            document.body.classList.contains('reduced-motion') ? 0 : PINNED_SUBPANEL_SLIDE_MS + 100
        );
    }

    function refreshPinnedRightSwitcherPanel(opts = {}) {
        if (!pinnedRightHost || !searchSwitcherButton) return;
        if (pinnedRightMutationDebounce) {
            clearTimeout(pinnedRightMutationDebounce);
            pinnedRightMutationDebounce = null;
        }
        const cancelPinnedSlideAnim = () => {
            const a = pinnedRightHost._pinnedSlideAnim;
            if (!a) return;
            const list = Array.isArray(a) ? a : [a];
            for (const anim of list) {
                try {
                    anim.cancel();
                } catch (_) {}
            }
            pinnedRightHost._pinnedSlideAnim = null;
        };
        if (window._searchEngineDragging) return;
        /* Badge float + placeholder mutate the primary dropdown; re-clone would replace the pinned copy and drop `engines-dragging`. */
        if (window._defaultBadgeDragging) return;
        /* Show clone when pinned-right mode is on and the search UI is expanded (focused). Outside-click collapse
         * removes focused and hides the clone without changing pin mode; focusing the input again reopens it.
         * Address bar column: same gate as suggestions — stay hidden on reload/autofocus until click or typing. */
        const show =
            document.body.classList.contains('search-engine-list-mode-pinned-right') &&
            searchContainer?.classList.contains('focused') &&
            (!addressbarColumnIframe || addressbarSuggestionsOpenEnabled);
        if (!show) {
            const shouldSlideOut =
                !!opts.slideOutPinned &&
                pinnedRightHost.querySelector('.search-switcher-dropdown') &&
                !pinnedRightHost.hidden;

            if (shouldSlideOut) {
                cancelPinnedSlideAnim();
                let w = pinnedRightHost.getBoundingClientRect().width;
                if (w < 8) {
                    try {
                        const src = searchSwitcherButton?.querySelector('.search-switcher-dropdown');
                        if (src) {
                            const mw = measurePinnedDropdownBaseWidth(src);
                            if (mw > 0) w = mw;
                        }
                    } catch (_) {}
                }
                if (w < 8) w = 280;
                const endX = -(w + 12);
                pinnedRightHost.style.zIndex = '4';
                void pinnedRightHost.offsetWidth;
                requestAnimationFrame(() => {
                    const movementDurationMs = 450;
                    const fadeDurationMs = movementDurationMs / 2; /* fade completes in half the movement time; same t=0 start */
                    const slideEasing = 'cubic-bezier(0.22, 1, 0.36, 1)';
                    const animOp = pinnedRightHost.animate(
                        [{ opacity: 1 }, { opacity: 0 }],
                        { duration: fadeDurationMs, easing: 'linear', fill: 'forwards', delay: 0 }
                    );
                    const animX = pinnedRightHost.animate(
                        [{ transform: 'translateX(0px)' }, { transform: `translateX(${endX}px)` }],
                        { duration: movementDurationMs, easing: slideEasing, fill: 'forwards', delay: 0 }
                    );
                    const ourPair = [animOp, animX];
                    pinnedRightHost._pinnedSlideAnim = ourPair;
                    Promise.all([animOp.finished, animX.finished]).finally(() => {
                        if (pinnedRightHost._pinnedSlideAnim === ourPair) {
                            pinnedRightHost._pinnedSlideAnim = null;
                        }
                        try {
                            animOp.cancel();
                            animX.cancel();
                        } catch (_) {}
                        pinnedRightHost.style.visibility = '';
                        pinnedRightHost.style.pointerEvents = '';
                        pinnedRightHost.style.zIndex = '';
                        pinnedRightHost.hidden = true;
                        pinnedRightHost.innerHTML = '';
                        syncEngineDragHandlesForControlsPanel();
                        try {
                            window.__scheduleAddressbarHeightReport?.();
                        } catch (_) {}
                    });
                });
                return;
            }

            cancelPinnedSlideAnim();
            pinnedRightHost.style.visibility = '';
            pinnedRightHost.style.pointerEvents = '';
            pinnedRightHost.style.zIndex = '';
            pinnedRightHost.hidden = true;
            pinnedRightHost.innerHTML = '';
            syncEngineDragHandlesForControlsPanel();
            try {
                window.__scheduleAddressbarHeightReport?.();
            } catch (_) {}
            return;
        }
        pinnedRightHost.setAttribute('aria-hidden', 'true');
        const source = searchSwitcherButton.querySelector('.search-switcher-dropdown');
        if (!source) return;
        const hadExistingClone = !!pinnedRightHost.querySelector('.search-switcher-dropdown');
        const preservedSubpanels = hadExistingClone ? capturePinnedCloneSubpanelState() : null;
        const preservedCloneOverflowToolbar = hadExistingClone ? capturePinnedCloneOverflowToolbarOpen() : false;
        const clone = source.cloneNode(true);
        clone.classList.add('search-switcher-dropdown--pinned-right');
        sanitizePinnedRightCloneRoot(clone);
        try {
            clone.style.width = `${measurePinnedDropdownBaseWidth(source)}px`;
        } catch (_) {}
        if (hadExistingClone && preservedSubpanels) {
            applyPinnedCloneSubpanelState(clone, preservedSubpanels);
        } else {
            applyPinnedCloneSubpanelState(clone, { controlsOpen: false, infoOpen: false });
        }
        const cloneLabel = clone.querySelector('.dropdown-label');
        if (cloneLabel) {
            /* Chip may have toolbar open; clone state is separate — restore only preserved clone strip. */
            setDropdownLabelOverflowToolsOpen(cloneLabel, !!preservedCloneOverflowToolbar, { immediate: true });
        }
        pinnedRightHost.replaceChildren(clone);
        /* Pinned list/grid follows :pinnedRight storage so the user can change it in the clone; seed that key only when entering pinned-right (see applySearchEngineListMode). */
        applySearchEnginesDisplayMode(
            getSearchEnginesDisplayModeForSurface(SEARCH_ENGINES_DISPLAY_SURFACE_PINNED),
            SEARCH_ENGINES_DISPLAY_SURFACE_PINNED,
            { skipStorage: true }
        );
        ensurePinnedRightMutationObserver();
        syncPinnedRightPanelLayoutAfterAppend(clone);
        syncEngineDragHandlesForControlsPanel();
        try {
            window.__scheduleAddressbarHeightReport?.();
        } catch (_) {}
        const slideInFromSuggestions =
            !!opts.slideInFromSuggestions &&
            !document.body.classList.contains('reduced-motion') &&
            !!searchContainer?.classList.contains('focused') &&
            !!document.querySelector('.search-container .suggestions-list')?.classList.contains('suggestions-revealed');

        cancelPinnedSlideAnim();

        if (slideInFromSuggestions) {
            pinnedRightHost.hidden = false;
            pinnedRightHost.style.visibility = 'hidden';
            pinnedRightHost.style.pointerEvents = 'none';
            void pinnedRightHost.offsetWidth;
            let w = pinnedRightHost.getBoundingClientRect().width;
            if (w < 8) {
                try {
                    const m = measurePinnedDropdownBaseWidth(source);
                    if (m > 0) w = m;
                } catch (_) {}
            }
            if (w < 8) w = 280;
            const startX = -(w + 12);
            pinnedRightHost.style.visibility = '';
            pinnedRightHost.style.pointerEvents = '';
            /* Do not force a low z-index here — it loses to .search-box-wrapper-outer (10) and the standalone toolbar. */
            pinnedRightHost.style.zIndex = '';
            void pinnedRightHost.offsetWidth;
            requestAnimationFrame(() => {
                const duration = 450;
                const slideEasing = 'cubic-bezier(0.22, 1, 0.36, 1)';
                const animOp = pinnedRightHost.animate(
                    [{ opacity: 0 }, { opacity: 1 }],
                    { duration, easing: 'linear', fill: 'forwards' }
                );
                const animX = pinnedRightHost.animate(
                    [
                        { transform: `translateX(${startX}px)` },
                        { transform: 'translateX(0px)' }
                    ],
                    { duration, easing: slideEasing, fill: 'forwards' }
                );
                const ourPair = [animOp, animX];
                pinnedRightHost._pinnedSlideAnim = ourPair;
                Promise.all([animOp.finished, animX.finished]).finally(() => {
                    if (pinnedRightHost._pinnedSlideAnim === ourPair) {
                        pinnedRightHost._pinnedSlideAnim = null;
                    }
                    try {
                        animOp.cancel();
                        animX.cancel();
                    } catch (_) {}
                    pinnedRightHost.style.zIndex = '';
                    try {
                        window.__scheduleAddressbarHeightReport?.();
                    } catch (_) {}
                });
            });
        } else {
            pinnedRightHost.hidden = false;
        }
        requestAnimationFrame(() => {
            try {
                window.__scheduleAddressbarHeightReport?.();
            } catch (_) {}
            syncPinnedRightPanelLayoutAfterAppend(clone);
            syncPinnedRightDropdownWidthFromPrimary(source);
            try {
                scheduleListEngineLabelTooltipSync();
            } catch (_) {}
        });
    }

    function installPinnedRightForwardingOnce() {
        if (!pinnedRightHost || pinnedRightHost.dataset.pinnedForwardInstalled) return;
        pinnedRightHost.dataset.pinnedForwardInstalled = '1';
        pinnedRightHost.addEventListener('click', onPinnedRightHostClickCapture, true);
        pinnedRightHost.addEventListener('change', onPinnedRightHostChangeCapture, true);
        pinnedRightHost.addEventListener('mousedown', onPinnedRightHostMouseDownCapture, true);
        if (!window.__pinnedRightPointerBlurGuardInstalled) {
            window.__pinnedRightPointerBlurGuardInstalled = true;
            const clearPinnedRightPointer = () => {
                pinnedRightHostPointerActive = false;
            };
            document.addEventListener('mouseup', clearPinnedRightPointer, true);
            document.addEventListener('pointerup', clearPinnedRightPointer, true);
            document.addEventListener('pointercancel', clearPinnedRightPointer, true);
            window.addEventListener('blur', clearPinnedRightPointer);
        }
    }
    installPinnedRightForwardingOnce();

    /** When the search switcher dropdown closes, fully settle info + controls sub-panels (not mid-animation). */
    function forceCloseSearchSwitcherSubPanels() {
        const panel = document.getElementById('search-engines-controls-panel');
        const infoPanel = document.getElementById('search-switcher-info-panel');
        const subpanelsClipEl = panel?.closest('.dropdown-switcher-subpanels-clip');
        subpanelsClipEl?.classList.remove('dropdown-switcher-subpanels-clip--open');
        searchSwitcherButton?.classList.remove('search-engines-controls-panel-revealed');
        searchSwitcherButton?.classList.remove('search-switcher-info-panel-footer-flip');
        panel?.setAttribute('hidden', '');
        infoPanel?.setAttribute('hidden', '');
        const controlsToggleEl = document.getElementById('search-engines-controls-toggle');
        if (controlsToggleEl) {
            if (isSearchSwitcherControlsVisibleByDefault()) {
                controlsToggleEl.removeAttribute('aria-expanded');
            } else {
                controlsToggleEl.setAttribute('aria-expanded', 'false');
            }
        }
        document.getElementById('search-switcher-info-toggle')?.setAttribute('aria-expanded', 'false');
        clearFromFirefoxFooterFlipStyles();
        syncEngineDragHandlesForControlsPanel();
        closeAllDropdownLabelOverflowTools();
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
        el.setAttribute('aria-checked', isChecked ? 'true' : 'false');
        el.removeAttribute('aria-pressed');
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
            toggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
            toggle.removeAttribute('aria-pressed');
            toggle.title = enabled ? 'Include in suggestions' : 'Exclude from suggestions';
        });
    }

    function ensureRowActions() {
        const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        if (!enginesContainer) return;
        const engineItems = Array.from(enginesContainer.querySelectorAll('.dropdown-item')).filter(
            el => el.querySelector('.dropdown-engine-label')
        );
        const openNewWindowHtml = '<span class="dropdown-item-row-action" aria-hidden="true"><span class="dropdown-item-keyboard-num" aria-hidden="true"></span><button type="button" class="dropdown-item-open-new-window" title="Run search in a new background tab" aria-label="Run search in a new background tab"><img src="icons/open-in-new-window.svg" alt=""></button></span>';
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
            badgeClasses: badge.className,
            gridMode: !!searchSwitcherButton?.querySelector(
                '.search-switcher-dropdown.search-engines-display-grid'
            ),
        });
    }

    function applySearchEnginesCountMode(count) {
        const n =
            count === 6 || count === 12 || count === 50
                ? count
                : getStoredSearchEnginesCount();
        ensurePrototypeSearchEngineRows();
        const allowed = new Set(getSearchEngineLabelsForCountMode(n));

        const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        if (enginesContainer) {
            enginesContainer.querySelectorAll('.dropdown-item').forEach((item) => {
                if (!item.querySelector('.dropdown-engine-label')) return;
                const label = getEngineLabel(item);
                item.style.display = allowed.has(label) ? '' : 'none';
            });

            const pinned = enginesContainer.querySelector('.dropdown-item-pinned');
            const pinnedLabel = pinned ? getEngineLabel(pinned) : '';
            if (pinned && pinnedLabel && !allowed.has(pinnedLabel)) {
                const items = Array.from(enginesContainer.querySelectorAll('.dropdown-item')).filter(
                    (el) => el.querySelector('.dropdown-engine-label') && el.style.display !== 'none'
                );
                const google = items.find((i) => getEngineLabel(i) === 'Google') || items[0];
                if (google) {
                    applySelectedSearchSource(google);
                    setDefaultSearchEngineStorageItem(getDefaultSearchEngineStorageKeyForPage(), getEngineLabel(google));
                    setPinnedEngine(google);
                    notifyParentDefaultSearchEngineChanged();
                }
            }
            try {
                ensureRowActions();
                updateKeyboardNumbers();
            } catch (_) {}
        }

        const oneOffContainer = document.querySelector('.one-off-engine-icons');
        if (oneOffContainer) {
            oneOffContainer.querySelectorAll('.one-off-engine-icon').forEach((btn) => {
                const img = btn.querySelector('img');
                const label = img?.getAttribute('alt')?.trim() || '';
                btn.style.display = allowed.has(label) ? '' : 'none';
            });
        }

        syncSearchSettingsDefaultEngineSelects();
        try {
            refreshPinnedRightSwitcherPanel();
        } catch (_) {}
        try {
            scheduleListEngineLabelTooltipSync();
        } catch (_) {}
        try {
            updateReorderResetButtonState();
        } catch (_) {}
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
            try {
                searchInput.focus({
                    preventScroll: document.body.classList.contains('addressbar'),
                });
            } catch (_) {
                searchInput.focus();
            }
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
                            try {
                                scheduleListEngineLabelTooltipSync();
                            } catch (_) {}
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
                !e.target.closest('.search-switcher-button') &&
                !e.target.closest('.search-switcher-pinned-right-host')) {
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
            // Pinned mode: click outside the clone and outside the search pill collapses UI and hides the clone; pin mode stays on so focusing the input reopens the clone.
            if (
                document.body.classList.contains('search-engine-list-mode-pinned-right') &&
                pinnedRightHost &&
                !pinnedRightHost.hidden &&
                e.target &&
                !e.target.closest?.('.search-switcher-pinned-right-host') &&
                !e.target.closest?.('.search-box-wrapper-outer')
            ) {
                collapseSearchUiPreservingPinned();
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
            if (e.target.closest?.('.search-switcher-pinned-right-host')) {
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
            handleDefaultBadgeDragMouseDown = (e) => {
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
                    if (!searchSwitcherButton.classList.contains('search-engines-controls-open')) {
                        return;
                    }
                    const enginesContainer = searchSwitcherButton.querySelector('.dropdown-search-engines');
                    const pinnedItem = enginesContainer?.querySelector('.dropdown-item-pinned');
                    const pinnedCloneRow = pinnedRightHost?.querySelector(
                        '.dropdown-search-engines .dropdown-item-pinned'
                    );
                    const isOnPrimaryPinned = !!(pinnedItem && pinnedItem.contains(badgeEl));
                    const isOnClonePinned = !!(pinnedCloneRow && pinnedCloneRow.contains(badgeEl));
                    if (!pinnedItem || !enginesContainer || (!isOnPrimaryPinned && !isOnClonePinned)) {
                        defaultBadgeDragLog('drag abort — badge not on primary or clone pinned row', {
                            ...badgeDragSurface,
                            hasPinned: !!pinnedItem,
                            hasEngines: !!enginesContainer,
                            containsPrimary: pinnedItem?.contains?.(badgeEl),
                            containsClone: pinnedCloneRow?.contains?.(badgeEl),
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
                    /* Same as engine row reorder: .engines-dragging suppresses :hover flicker on both chip + clone lists. */
                    enginesContainer.classList.add('engines-dragging');
                    pinnedRightHost?.querySelector('.search-switcher-dropdown .dropdown-search-engines')?.classList.add(
                        'engines-dragging'
                    );
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
                    const cloneEcForBadge = () =>
                        pinnedRightHost?.querySelector('.search-switcher-dropdown .dropdown-search-engines');
                    const resolvePrimaryEngineRowByLabel = (label) => {
                        if (!label || !enginesContainer) return null;
                        return (
                            Array.from(enginesContainer.querySelectorAll('.dropdown-item')).find(
                                (r) => r.querySelector('.dropdown-engine-label') && getEngineLabel(r) === label
                            ) || null
                        );
                    };
                    const clearHighlight = () => {
                        enginesContainer.querySelectorAll('.dropdown-item').forEach((el) => el.classList.remove('highlighted'));
                        cloneEcForBadge()?.querySelectorAll('.dropdown-item').forEach((el) => el.classList.remove('highlighted'));
                        ghostEl.style.display = 'none';
                    };
                    /**
                     * Hit-test engine rows under a point. Chip + clone share the same labels; `allowClone: false`
                     * skips clone rows (chip-only hit). For highlight/drop we use `allowClone: true` then map to
                     * primary via `resolvePrimaryEngineRowByLabel` so dragging from either surface works.
                     */
                    const findEngineRowUnderPoint = (clientX, clientY, { allowClone = true } = {}) => {
                        const stack = document.elementsFromPoint(clientX, clientY);
                        const ecClone = cloneEcForBadge();
                        for (let i = 0; i < stack.length; i++) {
                            const node = stack[i];
                            if (!node || typeof node.closest !== 'function') continue;
                            if (node === floatWrap || floatWrap.contains(node)) continue;
                            if (node === ghostEl || ghostEl.contains(node)) continue;
                            const row = node.closest('.dropdown-item');
                            if (!row || !row.querySelector('.dropdown-engine-label')) continue;
                            if (ecClone && ecClone.contains(row)) {
                                if (allowClone) return row;
                                continue;
                            }
                            if (enginesContainer.contains(row)) return row;
                        }
                        return null;
                    };
                    let loggedCloneHighlightMismatchThisDrag = false;
                    let lastCloneHoverStackLabel = '';
                    let lastPrimaryDragHighlightLabel = '';
                    /** List rows give `.dropdown-engine-label` flex:1 — element rect is full row width; badge sits after text. */
                    const rectForLabelTextContent = (labelEl) => {
                        if (!labelEl) return null;
                        try {
                            const range = document.createRange();
                            range.selectNodeContents(labelEl);
                            const br = range.getBoundingClientRect();
                            if (br.width > 0.5 && br.height > 0.5) return br;
                        } catch (_) {}
                        return labelEl.getBoundingClientRect();
                    };
                    const labelRectForBadgeGhost = (row) => {
                        const labelEl = row?.querySelector('.dropdown-engine-label');
                        if (!labelEl) return null;
                        let lr = rectForLabelTextContent(labelEl);
                        if (lr.width >= 2 && lr.height >= 2) return lr;
                        const lab = getEngineLabel(row);
                        const cloneEc = cloneEcForBadge();
                        const cloneRow =
                            lab &&
                            cloneEc &&
                            Array.from(cloneEc.querySelectorAll('.dropdown-item')).find((r) => getEngineLabel(r) === lab);
                        const cl = cloneRow?.querySelector('.dropdown-engine-label');
                        if (cl) return rectForLabelTextContent(cl);
                        return lr;
                    };
                    const highlightUnder = (clientX, clientY) => {
                        clearHighlight();
                        if (DEBUG_DEFAULT_BADGE_CLONE_HIGHLIGHT && !loggedCloneHighlightMismatchThisDrag) {
                            const ec = cloneEcForBadge();
                            if (ec) {
                                const ifCloneAllowed = findEngineRowUnderPoint(clientX, clientY, { allowClone: true });
                                const primaryOnly = findEngineRowUnderPoint(clientX, clientY, { allowClone: false });
                                if (ifCloneAllowed && ec.contains(ifCloneAllowed) && ifCloneAllowed !== primaryOnly) {
                                    loggedCloneHighlightMismatchThisDrag = true;
                                    defaultBadgeCloneHighlightLog(
                                        'clone row hit before primary under cursor (debug)',
                                        {
                                            cloneRowLabel: getEngineLabel(ifCloneAllowed),
                                            primaryRowLabel: primaryOnly ? getEngineLabel(primaryOnly) : null,
                                            clientX,
                                            clientY,
                                        }
                                    );
                                }
                            }
                        }
                        const rowUnder = findEngineRowUnderPoint(clientX, clientY, { allowClone: true });
                        if (!rowUnder?.querySelector('.dropdown-engine-label')) {
                            if (lastPrimaryDragHighlightLabel) {
                                defaultBadgeDragLog('default-badge drag .highlighted cleared — no engine row under point', {
                                    wasLabel: lastPrimaryDragHighlightLabel,
                                });
                                lastPrimaryDragHighlightLabel = '';
                            }
                            return;
                        }
                        const hlLabel = getEngineLabel(rowUnder);
                        const item = resolvePrimaryEngineRowByLabel(hlLabel);
                        if (!item) {
                            return;
                        }
                        /* Highlight only the row under the pointer (chip or pinned clone), not the duplicate row in the other panel. */
                        rowUnder.classList.add('highlighted');
                        if (hlLabel !== lastPrimaryDragHighlightLabel) {
                            lastPrimaryDragHighlightLabel = hlLabel;
                            defaultBadgeDragLog('default-badge drop-target .highlighted', {
                                label: hlLabel,
                                surface: cloneEcForBadge()?.contains(rowUnder) ? 'pinned-clone' : 'chip',
                                clientX,
                                clientY,
                            });
                        }
                        /* Ghost rect from the row actually under the cursor (often the visible clone); primary row
                         * can be clipped when the chip dropdown is closed so its label box is a poor anchor. */
                        const lr = labelRectForBadgeGhost(rowUnder);
                        if (!lr || lr.width < 1) return;
                        ghostEl.style.display = 'block';
                        ghostEl.style.width = `${wrapRect.width}px`;
                        ghostEl.style.height = `${wrapRect.height}px`;
                        ghostEl.style.left = `${lr.right + 8}px`;
                        ghostEl.style.top = `${lr.top + (lr.height - wrapRect.height) / 2}px`;
                    };
                    const BADGE_DRAG_SCROLL_ZONE = 36;
                    const BADGE_DRAG_SCROLL_SPEED = 8;
                    /**
                     * Topmost stack node inside the clone engines subtree → same row CSS :hover uses (unlike
                     * “first .dropdown-item in stack”, which can be the chip row while the pointer is still over the clone).
                     */
                    const logCloneHoverFromPointerStack = (clientX, clientY) => {
                        if (!DEBUG_DEFAULT_BADGE_CLONE_HOVER) return;
                        const ec = cloneEcForBadge();
                        if (!ec) return;
                        let cloneLabel = null;
                        try {
                            const stack = document.elementsFromPoint(clientX, clientY);
                            for (let i = 0; i < stack.length; i++) {
                                const node = stack[i];
                                if (!node || typeof node.closest !== 'function') continue;
                                if (node === floatWrap || floatWrap.contains(node)) continue;
                                if (node === ghostEl || ghostEl.contains(node)) continue;
                                if (!ec.contains(node)) continue;
                                const row = node.closest('.dropdown-item');
                                if (!row || !ec.contains(row) || !row.querySelector('.dropdown-engine-label')) continue;
                                cloneLabel = getEngineLabel(row);
                                break;
                            }
                        } catch (_) {}
                        const nextKey = cloneLabel || '';
                        if (nextKey === lastCloneHoverStackLabel) return;
                        lastCloneHoverStackLabel = nextKey;
                        if (cloneLabel) {
                            defaultBadgeCloneHoverLog('clone panel under pointer (CSS :hover target)', {
                                label: cloneLabel,
                                clientX,
                                clientY,
                            });
                        }
                    };
                    const onMove = (ev) => {
                        if (!window._defaultBadgeDragging) return;
                        floatWrap.style.left = `${ev.clientX - dragOffsetX}px`;
                        floatWrap.style.top = `${ev.clientY - dragOffsetY}px`;
                        highlightUnder(ev.clientX, ev.clientY);
                        logCloneHoverFromPointerStack(ev.clientX, ev.clientY);
                        const scrollEl = getEngineListScrollEl(
                            getHitTestEnginesContainerForReorder(enginesContainer)
                        );
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
                    logCloneHoverFromPointerStack(e.clientX, e.clientY);
                    const onUp = (ev) => {
                        if (!window._defaultBadgeDragging) return;
                        window._defaultBadgeDragging = false;
                        if (badgeDragScrollInterval) {
                            clearInterval(badgeDragScrollInterval);
                            badgeDragScrollInterval = null;
                        }
                        document.body.classList.remove('default-badge-dragging');
                        enginesContainer.classList.remove('engines-dragging');
                        pinnedRightHost?.querySelector('.search-switcher-dropdown .dropdown-search-engines')?.classList.remove(
                            'engines-dragging'
                        );
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                        document.body.style.cursor = prevCursor;
                        document.body.style.userSelect = prevUserSelect;
                        ghostEl.remove();
                        floatWrap.remove();
                        placeholderEl.remove();
                        lastCloneHoverStackLabel = '';
                        lastPrimaryDragHighlightLabel = '';
                        const rowUnder = findEngineRowUnderPoint(ev.clientX, ev.clientY, { allowClone: true });
                        clearHighlight();
                        const lab = rowUnder ? getEngineLabel(rowUnder) : '';
                        const primaryTarget = lab ? resolvePrimaryEngineRowByLabel(lab) : null;
                        const willApply =
                            primaryTarget &&
                            primaryTarget.querySelector('.dropdown-engine-label') &&
                            primaryTarget !== pinnedItem;
                        defaultBadgeDragLog('drag end (mouseup)', {
                            ...badgeDragSurface,
                            x: ev.clientX,
                            y: ev.clientY,
                            resolvedItem: lab || null,
                            willApplyNewDefault: !!willApply,
                        });
                        if (willApply) {
                            const label = getEngineLabel(primaryTarget);
                            if (label) {
                                applySelectedSearchSource(primaryTarget);
                                setDefaultSearchEngineStorageItem(getDefaultSearchEngineStorageKeyForPage(), label);
                                setPinnedEngine(primaryTarget);
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
            };
            searchSwitcherDropdown.addEventListener('mousedown', handleDefaultBadgeDragMouseDown, true);
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
            applySwitcherFromFirefoxSectionVisibility();
        }

        // Drag-and-drop reorder for search engines
        const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        if (enginesContainer) {
            let dragHoldTimer = null;
            let draggedItem = null;
            /** In-list row (greyed) while `draggedItem` is the floating ghost on `document.body`. */
            let dragSourceRow = null;
            let dragOffsetX = 0, dragOffsetY = 0;
            let dropMarker = null;
            let dropIndex = -1;
            let dragScrollInterval = null;
            let dragOriginalIndex = -1;
            /** Hit-test surface for list/grid geometry (clone when chip list is not painted; primary otherwise). */
            let dragHitEnginesContainer = null;
            /** True when the dragged row came from the pinned-right clone (ghost is clone DOM; primary row stays until endDrag). */
            let engineReorderDragFromPinnedClone = false;

            /** Real node under cursor when `event.target` is retargeted to an ancestor (Firefox: pinned host / dropdown roots). */
            const reorderPointerHitIn = (e, root) => {
                if (!root) return null;
                let p = null;
                try {
                    p = document.elementFromPoint(e.clientX, e.clientY);
                } catch (_) {}
                if (p instanceof Element && root.contains(p)) return p;
                if (e.target instanceof Element && root.contains(e.target)) return e.target;
                return null;
            };

            const getPrimaryEngineItems = () =>
                Array.from(enginesContainer.children).filter(
                    (c) => c.classList.contains('dropdown-item') && c.querySelector('.dropdown-engine-label')
                );

            const getHitTestEnginesContainer = () => getHitTestEnginesContainerForReorder(enginesContainer);

            /** Frozen to clone (or primary) for the whole drag so grid/list hit-test does not flip mid-gesture. */
            const activeHitSurface = () => dragHitEnginesContainer || getHitTestEnginesContainer();

            const getHitEngineItems = () => {
                const ec = activeHitSurface();
                return Array.from(ec.children).filter(
                    (c) =>
                        c.classList.contains('dropdown-item') &&
                        c.querySelector('.dropdown-engine-label') &&
                        c !== dragSourceRow
                );
            };

            const isGridMode = () => {
                const ec = activeHitSurface();
                const dd = ec?.closest?.('.search-switcher-dropdown');
                return !!(dd && dd.classList.contains('search-engines-display-grid'));
            };

            const getDropIndexFromY = (clientY) => {
                const hitEc = activeHitSurface();
                const items = getHitEngineItems();
                if (items.length === 0) return 0;
                const scrollEl = getEngineListScrollEl(hitEc);
                const viewportRect = scrollEl.getBoundingClientRect();
                if (clientY < viewportRect.top) return 0;
                if (clientY > viewportRect.bottom) return items.length;
                const rows = Array.from(hitEc.children).filter(
                    (c) =>
                        c.classList.contains('dropdown-item') &&
                        c.querySelector('.dropdown-engine-label') &&
                        c !== dragSourceRow
                );
                for (let i = 0; i < rows.length; i++) {
                    const rect = rows[i].getBoundingClientRect();
                    const mid = rect.top + rect.height / 2;
                    if (clientY < mid) {
                        const engineIndex = rows.slice(0, i).filter((r) => r.classList.contains('dropdown-item')).length;
                        return engineIndex;
                    }
                }
                return items.length;
            };

            const getGridDrop = (clientX, clientY) => {
                const hitEc = activeHitSurface();
                const items = getHitEngineItems();
                if (items.length === 0) return { index: 0, marker: null };

                const scrollEl = getEngineListScrollEl(hitEc);
                const viewportRect = scrollEl.getBoundingClientRect();
                const ecRect = hitEc.getBoundingClientRect();
                const visible = items
                    .map((el, idx) => ({ el, idx, rect: el.getBoundingClientRect() }))
                    .filter((r) => r.rect.width > 0 && r.rect.height > 0);
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
                const hitEc = activeHitSurface();
                const items = getHitEngineItems();
                if (index < 0 || index > items.length) return;
                if (!dropMarker) {
                    dropMarker = document.createElement('div');
                    dropMarker.className = 'dropdown-drop-marker';
                    dropMarker.setAttribute('aria-hidden', 'true');
                }
                if (dropIndex === index) return;
                dropIndex = index;
                const sortSectionForMarker = hitEc.querySelector('.engines-sort-section');
                if (!isGridMode()) {
                    dropMarker.className = 'dropdown-drop-marker';
                    dropMarker.style.left = '';
                    dropMarker.style.top = '';
                    dropMarker.style.height = '';
                    if (index >= items.length) {
                        hitEc.insertBefore(dropMarker, sortSectionForMarker || null);
                    } else {
                        hitEc.insertBefore(dropMarker, items[index]);
                    }
                    return;
                }

                // Grid mode: overlay a vertical bar between icon tiles (don’t consume a grid cell).
                dropMarker.className = 'dropdown-drop-marker dropdown-drop-marker-grid';
                if (dropMarker.parentNode !== hitEc) {
                    hitEc.appendChild(dropMarker);
                }
                // Position is set by onDragMove using getGridDrop().
            };

            const endDrag = () => {
                if (!draggedItem || !dragSourceRow) return;
                document.removeEventListener('mousemove', onDragMove);
                document.removeEventListener('mouseup', onDragEnd);
                document.removeEventListener('mouseleave', onDragEnd);
                if (dragScrollInterval) {
                    clearInterval(dragScrollInterval);
                    dragScrollInterval = null;
                }
                enginesContainer.classList.remove('engines-dragging');
                dragHitEnginesContainer?.classList.remove('engines-dragging');
                dragHitEnginesContainer = null;
                window._searchEngineDragging = false;

                const sortSectionEl = enginesContainer.querySelector('.engines-sort-section');
                const primaryItemsAll = getPrimaryEngineItems();
                const ghostEl = draggedItem;
                const sourceRow = dragSourceRow;
                let didMutatePrimaryEngineOrder = false;

                if (engineReorderDragFromPinnedClone) {
                    const lab = getEngineLabel(ghostEl);
                    const primaryRow = primaryItemsAll.find((r) => getEngineLabel(r) === lab);
                    const currentIndex = dragOriginalIndex;
                    const without = primaryItemsAll.filter((r) => r !== primaryRow);
                    const wouldChange =
                        primaryRow &&
                        dropIndex >= 0 &&
                        dropIndex !== currentIndex &&
                        dropIndex !== currentIndex + 1;
                    if (primaryRow && wouldChange) {
                        didMutatePrimaryEngineOrder = true;
                        if (dropIndex >= without.length) {
                            enginesContainer.insertBefore(primaryRow, sortSectionEl || null);
                        } else {
                            enginesContainer.insertBefore(primaryRow, without[dropIndex]);
                        }
                    }
                    ghostEl.remove();
                    sourceRow.classList.remove('dropdown-item--reorder-placeholder');
                    engineReorderDragFromPinnedClone = false;
                } else {
                    const workingItems = primaryItemsAll.filter((r) => r !== sourceRow);
                    const currentIndex = dragOriginalIndex;
                    const wouldChange = dropIndex >= 0 && dropIndex !== currentIndex && dropIndex !== currentIndex + 1;
                    if (wouldChange) {
                        didMutatePrimaryEngineOrder = true;
                        if (dropIndex >= workingItems.length) {
                            enginesContainer.insertBefore(sourceRow, sortSectionEl || null);
                        } else {
                            enginesContainer.insertBefore(sourceRow, workingItems[dropIndex]);
                        }
                    }
                    ghostEl.remove();
                    sourceRow.classList.remove('dropdown-item--reorder-placeholder');
                    sourceRow.style.left = '';
                    sourceRow.style.top = '';
                    sourceRow.style.width = '';
                }
                if (dropMarker?.parentNode) dropMarker.remove();
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                saveEngineOrder({ skipStorage: !didMutatePrimaryEngineOrder });
                draggedItem = null;
                dragSourceRow = null;
                dropMarker = null;
                dropIndex = -1;
                window._searchEngineDragOccurred = true;
                try {
                    if (
                        document.body.classList.contains('search-engine-list-mode-pinned-right') &&
                        searchContainer?.classList.contains('focused')
                    ) {
                        requestAnimationFrame(() => {
                            try {
                                refreshPinnedRightSwitcherPanel();
                            } catch (_) {}
                        });
                    }
                } catch (_) {}
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

                const scrollEl = getEngineListScrollEl(activeHitSurface());
                if (!scrollEl) return;
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

            const scheduleEngineReorderHold = (e, item, fromPinnedClone) => {
                if (!item || !item.querySelector('.dropdown-engine-label')) return;
                if (!searchSwitcherButton.classList.contains('search-engines-controls-open')) return;
                const rootForHit = fromPinnedClone
                    ? pinnedRightHost?.querySelector('.search-switcher-dropdown .dropdown-search-engines')
                    : enginesContainer;
                const hit = reorderPointerHitIn(e, rootForHit);
                if (
                    hit?.closest(
                        '.dropdown-item-pin-empty, .dropdown-item-pin, .dropdown-item-open-new-window, .dropdown-item-row-action'
                    )
                ) {
                    return;
                }
                e.preventDefault();

                const rect = item.getBoundingClientRect();
                const anchorEl = ['.dropdown-item-drag-handle', '.dropdown-item-pin-empty', '.dropdown-item-pin']
                    .map((sel) => item.querySelector(sel))
                    .find((el) => el && el.getBoundingClientRect().width > 0);
                if (anchorEl) {
                    const anchorRect = anchorEl.getBoundingClientRect();
                    dragOffsetX = anchorRect.left - rect.left - 20;
                    dragOffsetY = anchorRect.top - rect.top + anchorRect.height / 2;
                } else {
                    const iconEl = item.querySelector('.dropdown-engine-icon, .dropdown-icon');
                    if (iconEl) {
                        const iconRect = iconEl.getBoundingClientRect();
                        dragOffsetX = iconRect.left - rect.left + iconRect.width / 2;
                        dragOffsetY = iconRect.top - rect.top + iconRect.height / 2;
                    } else {
                        dragOffsetX = e.clientX - rect.left;
                        dragOffsetY = e.clientY - rect.top;
                    }
                }

                dragHoldTimer = setTimeout(() => {
                    dragHoldTimer = null;
                    engineReorderDragFromPinnedClone = fromPinnedClone;
                    if (fromPinnedClone) {
                        const hitEc = pinnedRightHost?.querySelector('.search-switcher-dropdown .dropdown-search-engines');
                        if (!hitEc || !hitEc.contains(item)) {
                            engineReorderDragFromPinnedClone = false;
                            return;
                        }
                        dragHitEnginesContainer = hitEc;
                        const pri = getPrimaryEngineItems();
                        const lab = getEngineLabel(item);
                        const pr = pri.find((r) => getEngineLabel(r) === lab);
                        dragOriginalIndex = pr != null ? pri.indexOf(pr) : -1;
                        dragHitEnginesContainer.classList.add('engines-dragging');
                    } else {
                        /* Always hit-test the primary list: `dragSourceRow` lives there, and `workingItems` /
                         * `wouldChange` are primary indices. Using the pinned-right clone here breaks
                         * `getHitEngineItems()` (clone rows never equal `dragSourceRow`), so dropIndex is
                         * off by one and a no-op release can still mutate order / show Restore A-Z (iframes). */
                        dragHitEnginesContainer = enginesContainer;
                        dragHitEnginesContainer.classList.add('engines-dragging');
                        enginesContainer.classList.add('engines-dragging');
                        dragOriginalIndex = getPrimaryEngineItems().indexOf(item);
                    }

                    dragSourceRow = item;
                    const ghost = item.cloneNode(true);
                    ghost.querySelectorAll?.('[id]').forEach((el) => el.removeAttribute('id'));
                    ghost.classList.remove('highlighted');
                    ghost.classList.add('dragging');
                    ghost.style.width = rect.width + 'px';
                    ghost.style.left = e.clientX - dragOffsetX + 'px';
                    ghost.style.top = e.clientY - dragOffsetY + 'px';
                    document.body.appendChild(ghost);
                    draggedItem = ghost;
                    dragSourceRow.classList.add('dropdown-item--reorder-placeholder');
                    window._searchEngineDragging = true;
                    document.body.style.cursor = 'grabbing';
                    document.body.style.userSelect = 'none';
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
            };

            enginesContainer.addEventListener('mousedown', (e) => {
                const hit = reorderPointerHitIn(e, enginesContainer);
                const item = hit?.closest('.dropdown-item');
                scheduleEngineReorderHold(e, item, false);
            });

            engineReorderHandlePinnedCloneMousedown = (e) => {
                const root = pinnedRightHost?.querySelector('.search-switcher-dropdown .dropdown-search-engines');
                const hit = reorderPointerHitIn(e, root);
                const handle = hit?.closest('.dropdown-item-drag-handle');
                if (!handle) return;
                const item = handle.closest('.dropdown-item');
                if (!item || !pinnedRightHost?.contains(item)) return;
                scheduleEngineReorderHold(e, item, true);
            };

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

        function saveEngineOrder(opts) {
            const enginesContainer = searchSwitcherButton?.querySelector('.dropdown-search-engines');
            if (!enginesContainer) return;
            const items = Array.from(enginesContainer.querySelectorAll('.dropdown-item')).filter(
                el => el.querySelector('.dropdown-engine-label')
            );
            const order = items.map(item => getEngineLabel(item));
            if (order.length && !opts?.skipStorage) {
                try {
                    getSearchEngineOrderStorage().setItem(SEARCH_ENGINE_ORDER_KEY, JSON.stringify(order));
                } catch (_) {}
            }
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

        if (window === window.top) {
            try {
                const rawHero = localStorage.getItem(MAIN_SCREEN_HERO_LOGO_MODE_KEY);
                if (rawHero === 'firefox') {
                    /* keep */
                } else if (rawHero === 'search_engine') {
                    /* keep */
                } else {
                    localStorage.setItem(MAIN_SCREEN_HERO_LOGO_MODE_KEY, DEFAULT_MAIN_SCREEN_HERO_LOGO_MODE);
                }
            } catch (_) {}
            const savedHero = getMainScreenHeroLogoMode();
            applyMainScreenHeroLogoMode(savedHero);
            syncMainScreenHeroLogoRadiosToMode(savedHero);
            document
                .querySelectorAll('input[name="main-screen-hero-logo"], input[name="main-screen-hero-logo-settings"]')
                .forEach((radio) => {
                    radio.addEventListener('change', (e) => {
                        const t = e.target;
                        if (!t.checked) return;
                        const mode = t.value === 'firefox' ? 'firefox' : 'search_engine';
                        try {
                            localStorage.setItem(MAIN_SCREEN_HERO_LOGO_MODE_KEY, mode);
                        } catch (_) {}
                        applyMainScreenHeroLogoMode(mode);
                        syncMainScreenHeroLogoRadiosToMode(mode);
                        const chipItem = getDropdownItemMatchingSearchBarChip();
                        if (chipItem) syncMainScreenBrandFromSwitcherItem(chipItem);
                    });
                });
        }

        // Restore saved default search engine and order on load
        const enginesContainerForRestore = searchSwitcherButton?.querySelector('.dropdown-search-engines');
        if (enginesContainerForRestore) {
            const engineItems = Array.from(enginesContainerForRestore.querySelectorAll('.dropdown-item')).filter(
                el => el.querySelector('.dropdown-engine-label')
            );
            const savedOrder = (() => {
                try {
                    return getSearchEngineOrderStorage().getItem(SEARCH_ENGINE_ORDER_KEY);
                } catch (_) {
                    return null;
                }
            })();
            let appliedSavedOrder = false;
            if (savedOrder) {
                try {
                    const order = JSON.parse(savedOrder);
                    const byLabel = new Map(engineItems.map(item => [getEngineLabel(item), item]));
                    const ordered = order.map(label => byLabel.get(label)).filter(Boolean);
                    const rest = engineItems.filter(item => !order.includes(getEngineLabel(item)));
                    ordered.concat(rest).forEach(item => enginesContainerForRestore.appendChild(item));
                    appliedSavedOrder = true;
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
            if (!appliedSavedOrder) {
                applyCanonicalSearchEngineOrder(enginesContainerForRestore, sortSection);
            } else {
                setEnginesSortSectionHiddenIfAlphabetical(enginesContainerForRestore, sortSection);
            }

            const resetOrderBtn =
                document.getElementById('search-engines-reset-order-button') ||
                document.getElementById('ab-search-engines-reset-order-button');
            if (resetOrderBtn) {
                resetOrderBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (resetOrderBtn.hasAttribute('hidden')) return;
                    resetSearchEnginesOrderToAlphabetical();
                });
            }

            document.addEventListener(
                'click',
                (e) => {
                    let b = e.target.closest('.search-engines-restore-az-sticky-button');
                    if (!b) {
                        let el = null;
                        try {
                            el = document.elementFromPoint(e.clientX, e.clientY);
                        } catch (_) {}
                        b = el?.closest?.('.search-engines-restore-az-sticky-button') ?? null;
                    }
                    if (!b || b.disabled) return;
                    const sticky = b.closest('.dropdown-restore-az-sticky');
                    if (!sticky || !sticky.classList.contains('dropdown-restore-az-sticky--revealed')) return;
                    e.preventDefault();
                    e.stopPropagation();
                    resetSearchEnginesOrderToAlphabetical();
                },
                true
            );

            updateReorderResetButtonState();
            applySearchEnginesCountMode(getStoredSearchEnginesCount());
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

    const dismissableStraplineCheckbox = document.querySelector('.dismissable-strapline-checkbox');
    const applyDismissableStraplinePrototype = (on) => {
        document.body.classList.toggle('dismissable-strapline-enabled', on);
        const row = document.querySelector('.main-screen-brand-firefox-row');
        if (row) {
            if (on) {
                try {
                    row.hidden = localStorage.getItem(MAIN_SCREEN_BRAND_STRAPLINE_DISMISSED_KEY) === 'true';
                } catch (_) {
                    row.hidden = false;
                }
            } else {
                row.hidden = false;
            }
        }
        try {
            localStorage.setItem(DISMISSABLE_STRAPLINE_ENABLED_KEY, on ? 'true' : 'false');
        } catch (_) {}
    };
    if (dismissableStraplineCheckbox) {
        dismissableStraplineCheckbox.checked = document.body.classList.contains('dismissable-strapline-enabled');
        dismissableStraplineCheckbox.addEventListener('change', (e) => {
            applyDismissableStraplinePrototype(!!e.target.checked);
        });
    }

    const prototypeBrowserChromeCheckbox = document.querySelector('.prototype-browser-chrome-checkbox');
    if (prototypeBrowserChromeCheckbox) {
        prototypeBrowserChromeCheckbox.checked = !document.body.classList.contains('browser-chrome-hidden');
        prototypeBrowserChromeCheckbox.addEventListener('change', (e) => {
            const on = e.target.checked;
            if (on) {
                document.body.classList.remove('browser-chrome-hidden');
                try {
                    localStorage.setItem(PROTOTYPE_BROWSER_CHROME_VISIBLE_KEY, 'true');
                } catch (_) {}
                syncPrototypeBrowserChromeUrlParam(true);
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        try {
                            window.__prototypeRemeasureAddressbarBand?.();
                        } catch (_) {}
                    });
                });
            } else {
                document.body.classList.add('browser-chrome-hidden');
                try {
                    localStorage.setItem(PROTOTYPE_BROWSER_CHROME_VISIBLE_KEY, 'false');
                } catch (_) {}
                syncPrototypeBrowserChromeUrlParam(false);
            }
        });
    }

    const prototypeShowNewTabContentCheckbox = document.querySelector('.prototype-show-new-tab-content-checkbox');
    if (prototypeShowNewTabContentCheckbox) {
        prototypeShowNewTabContentCheckbox.checked = !document.body.classList.contains(
            'prototype-new-tab-content-hidden'
        );
        prototypeShowNewTabContentCheckbox.addEventListener('change', (e) => {
            const show = !!e.target.checked;
            document.body.classList.toggle('prototype-new-tab-content-hidden', !show);
            syncPrototypeNewTabContentUrlParam(show);
        });
    }

    // Search focus ring colour (paired with background swatches in prototype UI; optional legacy colour swatches)
    const searchBorderSwatches = document.querySelectorAll('.search-border-swatch');
    const initialSearchBorder = getStoredSearchBorderColor();
    persistSearchBorderColorForPrototype(initialSearchBorder);
    if (searchBorderSwatches.length) {
        const persistAndApply = (hex) => {
            persistSearchBorderColorForPrototype(hex);
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
        searchBorderSwatches.forEach((btn) => {
            btn.addEventListener('click', () => {
                persistAndApply(btn.dataset.borderColor);
            });
        });
    }

    // Default engine is always the “DEFAULT” badge in the list (list pins for default are retired).
    {
        document.body.classList.remove('pin-default-enabled');
        updateDefaultBadge();
        syncSearchSwitcherPanelPinToggle();
    }

    // Number of search engines: 6 / 12 / 50 (default: 6); scoped by name (Hero logo reuses .search-engines-count-radio).
    const searchEnginesCountRadios = document.querySelectorAll('input[name="search-engines-count"]');
    if (searchEnginesCountRadios.length) {
        const count = getStoredSearchEnginesCount();
        searchEnginesCountRadios.forEach((radio) => {
            radio.checked = parseInt(radio.value, 10) === count;
        });
        applySearchEnginesCountMode(count);
        searchEnginesCountRadios.forEach((radio) => {
            radio.addEventListener('change', () => {
                if (!radio.checked) return;
                const n = parseInt(radio.value, 10);
                if (n !== 6 && n !== 12 && n !== 50) return;
                try {
                    getDefaultSearchEngineLocalStorage().setItem(SEARCH_ENGINES_COUNT_KEY, String(n));
                } catch (_) {}
                applySearchEnginesCountMode(n);
                [document.querySelector('.addressbar-iframe'), document.querySelector('.standalone-search-box-iframe')]
                    .filter(Boolean)
                    .forEach((f) => {
                        try {
                            f.contentWindow?.postMessage({ type: 'search-engines-count', count: n }, '*');
                            f.contentWindow?.postMessage(
                                { type: 'twelve-search-engines', enabled: n !== 6, count: n },
                                '*'
                            );
                        } catch (_) {}
                    });
            });
        });
    }

    // List/grid segmented control in the switcher label or lilac panel (per-search-bar preference).
    const flipSearchEnginesDisplayMode = (surface = SEARCH_ENGINES_DISPLAY_SURFACE_PRIMARY) => {
        const current = getSearchEnginesDisplayModeForSurface(surface);
        const next = current === 'grid' ? 'list' : 'grid';
        applySearchEnginesDisplayMode(next, surface);
    };
    flipSearchEnginesDisplayModeForPinned = () => flipSearchEnginesDisplayMode(SEARCH_ENGINES_DISPLAY_SURFACE_PINNED);
    document
        .querySelectorAll(
            `[data-search-engines-display-toggle="${SEARCH_ENGINES_DISPLAY_SURFACE_PRIMARY}"], [data-search-engines-display-toggle="${SEARCH_ENGINES_DISPLAY_SURFACE_PINNED}"]`
        )
        .forEach((searchEnginesDisplayToggle) => {
            const surfaceAttr = searchEnginesDisplayToggle.getAttribute('data-search-engines-display-toggle');
            const surface =
                surfaceAttr === SEARCH_ENGINES_DISPLAY_SURFACE_PINNED
                    ? SEARCH_ENGINES_DISPLAY_SURFACE_PINNED
                    : SEARCH_ENGINES_DISPLAY_SURFACE_PRIMARY;
            searchEnginesDisplayToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                flipSearchEnginesDisplayMode(surface);
            });
            searchEnginesDisplayToggle.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                if (!searchEnginesDisplayToggle.contains(e.target)) return;
                e.preventDefault();
                e.stopPropagation();
                flipSearchEnginesDisplayMode(surface);
            });
        });

    document.querySelectorAll('.search-engines-pin-default-toggle').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSearchSwitcherPanelPin();
        });
    });

    document.querySelectorAll('.search-switcher-more-menu-button').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdownLabelOverflowTools(btn);
        });
        btn.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            toggleDropdownLabelOverflowTools(btn);
        });
    });

    const searchEnginesControlsToggle = document.getElementById('search-engines-controls-toggle');
    const searchEnginesControlsPanel = document.getElementById('search-engines-controls-panel');
    const searchSwitcherInfoToggle = document.getElementById('search-switcher-info-toggle');
    const searchSwitcherInfoPanel = document.getElementById('search-switcher-info-panel');
    const subpanelsClip = searchEnginesControlsPanel?.closest('.dropdown-switcher-subpanels-clip');

    const syncSubpanelsClipOpen = () => {
        if (!subpanelsClip) return;
        const controlsOpen = searchEnginesControlsPanel && !searchEnginesControlsPanel.hasAttribute('hidden');
        subpanelsClip.classList.toggle(
            'dropdown-switcher-subpanels-clip--open',
            !!controlsOpen
        );
    };

    const syncSearchEnginesControlsExpanded = () => {
        if (!searchEnginesControlsPanel || !searchEnginesControlsToggle) return;
        const open = !searchEnginesControlsPanel.hasAttribute('hidden');
        if (isSearchSwitcherControlsVisibleByDefault()) {
            searchEnginesControlsToggle.removeAttribute('aria-expanded');
        } else {
            searchEnginesControlsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
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
        subpanelsClip.classList.remove('dropdown-switcher-subpanels-clip--open');
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
            if (isSearchSwitcherControlsVisibleByDefault()) {
                document.getElementById('more-search-settings-button')?.click();
                return;
            }
            toggleSearchEnginesControlsPanel();
        });
        searchEnginesControlsToggle.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            if (isSearchSwitcherControlsVisibleByDefault()) {
                document.getElementById('more-search-settings-button')?.click();
                return;
            }
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
                searchSwitcherInfoToggle.setAttribute('aria-expanded', 'true');
                syncSearchSwitcherDropdownWidth();
                requestAnimationFrame(() => syncSearchSwitcherDropdownWidth());
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
            const clipWasOpen = subpanelsClip.classList.contains('dropdown-switcher-subpanels-clip--open');
            subpanelsClip.classList.remove('dropdown-switcher-subpanels-clip--open');
            searchSwitcherButton?.classList.add('search-switcher-info-panel-footer-flip');
            searchSwitcherInfoToggle.setAttribute('aria-expanded', 'false');
            if (wantFooterFlip && footerFlipFirstRect) {
                runFromFirefoxFooterFlipTransition(footer, footerFlipFirstRect);
            }
            let settled = false;
            let fallbackTimer = null;
            const settle = () => {
                if (settled) return;
                settled = true;
                subpanelsClip.removeEventListener('transitionend', onTrEnd);
                if (fallbackTimer != null) clearTimeout(fallbackTimer);
                searchSwitcherInfoPanel.setAttribute('hidden', '');
                searchSwitcherButton?.classList.remove('search-switcher-info-panel-footer-flip');
                syncSearchSwitcherDropdownWidth();
            };
            const onTrEnd = (ev) => {
                if (ev.target !== subpanelsClip || ev.propertyName !== 'grid-template-rows') return;
                settle();
            };
            if (!clipWasOpen) {
                settle();
                return;
            }
            subpanelsClip.addEventListener('transitionend', onTrEnd);
            fallbackTimer = setTimeout(
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

    applyStandaloneSearchBoxPrototypeVisibility(readStandaloneSearchBoxVisibleFromStorage());
    const standaloneVisibilityToggle = document.getElementById('search-settings-standalone-visibility-toggle');
    if (standaloneVisibilityToggle) {
        standaloneVisibilityToggle.addEventListener('click', () => {
            const nextOn = standaloneVisibilityToggle.getAttribute('aria-checked') !== 'true';
            applyStandaloneSearchBoxPrototypeVisibility(nextOn);
        });
    }
    document.addEventListener(
        'keydown',
        (e) => {
            if (window !== window.top) return;
            if (e.repeat) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const t = e.target;
            if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) {
                return;
            }
            if (t && typeof t === 'object' && 'closest' in t && t.closest?.('[contenteditable="true"]')) {
                return;
            }
            if (e.key === '/') {
                e.preventDefault();
                applyStandaloneSearchBoxPrototypeVisibility(!readStandaloneSearchBoxVisibleFromStorage());
                return;
            }
            /* Cycle Visuals background swatches (gradient → grey → blue → beige). */
            if (e.key === ',') {
                e.preventDefault();
                cyclePrototypeBackgroundSwatch();
                return;
            }
            /* Toggle large / small corners (prototype panel swatches). */
            if (e.key === '.') {
                e.preventDefault();
                const next = getSearchBorderRadiusMode() === 'large' ? 'small' : 'large';
                try {
                    localStorage.setItem(SEARCH_BORDER_RADIUS_MODE_KEY, next);
                } catch (_) {}
                refreshSearchBorderRadiusMode();
                if (window === window.top) {
                    [document.querySelector('.addressbar-iframe'), document.querySelector('.standalone-search-box-iframe')]
                        .filter(Boolean)
                        .forEach((f) => {
                            try {
                                f.contentWindow?.postMessage({ type: 'search-border-radius-mode', mode: next }, '*');
                            } catch (_) {}
                        });
                }
                return;
            }
        },
        true
    );

    const searchSettingsModal = document.getElementById('search-settings-modal');
    let searchSettingsModalPreviousFocus = null;
    let searchSettingsModalPanelDrag = { x: 0, y: 0 };
    const applySearchSettingsModalPanelTransform = () => {
        const panel = searchSettingsModal?.querySelector('.search-settings-modal-panel');
        if (!panel) return;
        if (searchSettingsModalPanelDrag.x === 0 && searchSettingsModalPanelDrag.y === 0) {
            panel.style.removeProperty('transform');
        } else {
            panel.style.transform = `translate(${searchSettingsModalPanelDrag.x}px, ${searchSettingsModalPanelDrag.y}px)`;
        }
    };
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
        syncSearchSettingsModalUrlParam(false);
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
        searchSettingsModalPanelDrag.x = 0;
        searchSettingsModalPanelDrag.y = 0;
        applySearchSettingsModalPanelTransform();
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
        const navigateNewTabCbOpen = document.getElementById('search-settings-navigate-new-tab');
        if (navigateNewTabCbOpen) {
            try {
                navigateNewTabCbOpen.checked = localStorage.getItem(SEARCH_SETTINGS_NAVIGATE_NEW_TAB_KEY) === 'true';
            } catch (_) {}
        }
        const navigatePrivateCbOpen = document.getElementById('search-settings-navigate-private');
        if (navigatePrivateCbOpen) {
            try {
                navigatePrivateCbOpen.checked = localStorage.getItem(SEARCH_SETTINGS_NAVIGATE_PRIVATE_KEY) === 'true';
            } catch (_) {}
        }
        const searchAddressBarCbOpen = document.getElementById('search-settings-search-address-bar');
        if (searchAddressBarCbOpen) {
            try {
                searchAddressBarCbOpen.checked = localStorage.getItem(SEARCH_SETTINGS_SEARCH_ADDRESS_BAR_KEY) !== 'false';
            } catch (_) {}
        }
        const standaloneToggleOpen = document.getElementById('search-settings-standalone-visibility-toggle');
        if (standaloneToggleOpen) {
            const v = readStandaloneSearchBoxVisibleFromStorage();
            standaloneToggleOpen.setAttribute('aria-checked', v ? 'true' : 'false');
            standaloneToggleOpen.classList.toggle('search-settings-standalone-visibility-toggle--on', v);
        }
        logSearchSettingsOverlayOpened();
        syncSearchSettingsPlaceholderPreviewFields();
        searchSettingsModalPreviousFocus = document.activeElement;
        searchSettingsModal.hidden = false;
        searchSettingsModal.setAttribute('aria-hidden', 'false');
        syncSearchSettingsModalUrlParam(true);
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
        const searchSettingsModalHeader = searchSettingsModal.querySelector('.search-settings-modal-header');
        const searchSettingsModalPanel = searchSettingsModal.querySelector('.search-settings-modal-panel');
        if (searchSettingsModalHeader && searchSettingsModalPanel) {
            searchSettingsModalHeader.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                if (e.target.closest('.search-settings-modal-close')) return;
                e.preventDefault();
                const startX = e.clientX;
                const startY = e.clientY;
                const ox = searchSettingsModalPanelDrag.x;
                const oy = searchSettingsModalPanelDrag.y;
                searchSettingsModalHeader.setPointerCapture(e.pointerId);
                searchSettingsModalHeader.classList.add('search-settings-modal-header--dragging');
                const onMove = (ev) => {
                    searchSettingsModalPanelDrag.x = ox + (ev.clientX - startX);
                    searchSettingsModalPanelDrag.y = oy + (ev.clientY - startY);
                    applySearchSettingsModalPanelTransform();
                };
                const onUp = (ev) => {
                    searchSettingsModalHeader.classList.remove('search-settings-modal-header--dragging');
                    try {
                        searchSettingsModalHeader.releasePointerCapture(ev.pointerId);
                    } catch (_) {}
                    searchSettingsModalHeader.removeEventListener('pointermove', onMove);
                    searchSettingsModalHeader.removeEventListener('pointerup', onUp);
                    searchSettingsModalHeader.removeEventListener('pointercancel', onUp);
                };
                searchSettingsModalHeader.addEventListener('pointermove', onMove);
                searchSettingsModalHeader.addEventListener('pointerup', onUp);
                searchSettingsModalHeader.addEventListener('pointercancel', onUp);
            });
        }
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
                syncSearchSettingsPlaceholderPreviewFields();
                broadcastSearchAccessPointPlaceholderRefresh();
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
                syncSearchSettingsPlaceholderPreviewFields();
                broadcastSearchAccessPointPlaceholderRefresh();
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
                syncSearchSettingsPlaceholderPreviewFields();
                broadcastSearchAccessPointPlaceholderRefresh();
            });
        }
        const selPrivate = document.getElementById('search-settings-default-engine-private');
        if (selPrivate) {
            selPrivate.addEventListener('change', () => {
                syncSearchSettingsPlaceholderPreviewFields();
            });
        }
        const navigateNewTabCb = document.getElementById('search-settings-navigate-new-tab');
        if (navigateNewTabCb) {
            try {
                navigateNewTabCb.checked = localStorage.getItem(SEARCH_SETTINGS_NAVIGATE_NEW_TAB_KEY) === 'true';
            } catch (_) {}
            navigateNewTabCb.addEventListener('change', () => {
                try {
                    localStorage.setItem(
                        SEARCH_SETTINGS_NAVIGATE_NEW_TAB_KEY,
                        navigateNewTabCb.checked ? 'true' : 'false'
                    );
                } catch (_) {}
                applySwitcherFromFirefoxSectionVisibility();
                syncSearchSettingsPlaceholderPreviewFields();
                broadcastSearchAccessPointPlaceholderRefresh();
            });
        }
        const navigatePrivateCb = document.getElementById('search-settings-navigate-private');
        if (navigatePrivateCb) {
            try {
                navigatePrivateCb.checked = localStorage.getItem(SEARCH_SETTINGS_NAVIGATE_PRIVATE_KEY) === 'true';
            } catch (_) {}
            navigatePrivateCb.addEventListener('change', () => {
                try {
                    localStorage.setItem(
                        SEARCH_SETTINGS_NAVIGATE_PRIVATE_KEY,
                        navigatePrivateCb.checked ? 'true' : 'false'
                    );
                } catch (_) {}
                syncSearchSettingsPlaceholderPreviewFields();
                broadcastSearchAccessPointPlaceholderRefresh();
            });
        }
        const searchAddressBarCb = document.getElementById('search-settings-search-address-bar');
        if (searchAddressBarCb) {
            try {
                searchAddressBarCb.checked = localStorage.getItem(SEARCH_SETTINGS_SEARCH_ADDRESS_BAR_KEY) !== 'false';
            } catch (_) {}
            searchAddressBarCb.addEventListener('change', () => {
                try {
                    localStorage.setItem(
                        SEARCH_SETTINGS_SEARCH_ADDRESS_BAR_KEY,
                        searchAddressBarCb.checked ? 'true' : 'false'
                    );
                } catch (_) {}
                if (window === window.top && !searchAddressBarCb.checked) {
                    /* Navigate-only address bar: pinned engine list is meaningless — unpin in the iframe only. */
                    try {
                        document.querySelector('.addressbar-iframe')?.contentWindow?.postMessage(
                            { type: 'search-engine-list-mode', mode: 'closed', animate: true },
                            '*'
                        );
                    } catch (_) {}
                }
                syncSearchSettingsPlaceholderPreviewFields();
                broadcastSearchAccessPointPlaceholderRefresh();
            });
        }
        applySwitcherFromFirefoxSectionVisibility();
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
    const standaloneSearchBoxToolbarSearchSettingsButton = document.getElementById(
        'standalone-search-box-toolbar-search-settings-button'
    );
    if (standaloneSearchBoxToolbarSearchSettingsButton) {
        if (searchSettingsModal) {
            standaloneSearchBoxToolbarSearchSettingsButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openSearchSettingsModal();
            });
        } else if (window !== window.top) {
            standaloneSearchBoxToolbarSearchSettingsButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    window.parent.postMessage({ type: 'open-search-settings' }, '*');
                } catch (_) {}
            });
        }
    }
    window.addEventListener('storage', (e) => {
        if (e.storageArea !== localStorage) return;
        if (
            e.key === SEARCH_SETTINGS_NAVIGATE_NEW_TAB_KEY ||
            e.key === SEARCH_SETTINGS_NAVIGATE_PRIVATE_KEY ||
            e.key === SEARCH_SETTINGS_SEARCH_ADDRESS_BAR_KEY
        ) {
            try {
                applySearchInputPlaceholderFromAccessPointSettings(null);
            } catch (_) {}
            syncSearchSettingsPlaceholderPreviewFields();
            broadcastSearchAccessPointPlaceholderRefresh();
            return;
        }
        if (
            e.key !== DEFAULT_SEARCH_ENGINE_KEY_MAIN &&
            e.key !== DEFAULT_SEARCH_ENGINE_KEY_ADDRESSBAR &&
            e.key !== DEFAULT_SEARCH_ENGINE_KEY_STANDALONE &&
            e.key !== TWELVE_SEARCH_ENGINES_ENABLED_KEY &&
            e.key !== SEARCH_ENGINES_COUNT_KEY
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
                try {
                    e.source?.postMessage?.(
                        {
                            type: 'refresh-search-access-point-placeholder',
                            keys: getSearchAccessPointSettingsKeysForMirror(),
                        },
                        '*'
                    );
                } catch (_) {}
                return;
            }
            if (e.data?.type === 'default-search-engine-changed') {
                // Same-origin iframes; do not rely on e.source === iframe.contentWindow (timing can fail).
                if (e.origin === window.location.origin || e.origin === 'null') {
                    syncSearchSettingsDefaultEngineSelects();
                    syncSearchSettingsPlaceholderPreviewFields();
                    broadcastSearchAccessPointPlaceholderRefresh();
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
    /** Address bar iframe: shift the pill right when pinned outside, and counter-shift the chip so it stays put. */
    const syncAddressbarPinnedSwitcherOffset = () => {
        const isAddressbar = document.body.classList.contains('addressbar');
        const isStandaloneIframe = document.body.classList.contains('standalone-search-box');
        const outside = document.body.classList.contains('switcher-outside-search-box-enabled');
        if (isAddressbar && !isStandaloneIframe && outside && searchSwitcherButton) {
            const gap = 12;
            const w = Math.round(searchSwitcherButton.offsetWidth + gap);
            document.documentElement.style.setProperty('--addressbar-pinned-switcher-offset', `${w}px`);
        } else {
            document.documentElement.style.removeProperty('--addressbar-pinned-switcher-offset');
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
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                try {
                    syncAddressbarPinnedSwitcherOffset();
                } catch (_) {}
            });
        });
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
            localStorage.setItem(getSearchEngineListModeStorageKey(), m);
        } catch (_) {}
        const wasPinnedRight = document.body.classList.contains('search-engine-list-mode-pinned-right');
        /* One-shot when pinning: copy chip grid/list into :pinnedRight so the clone opens matching the open panel; later refreshes use stored pinned preference only. */
        if (
            !wasPinnedRight &&
            m === 'pinned-right' &&
            options.seedPinnedDisplayFromPrimary === true &&
            searchSwitcherButton
        ) {
            const primaryDd = searchSwitcherButton.querySelector('.search-switcher-dropdown');
            const modeFromChip = primaryDd?.classList.contains('search-engines-display-grid') ? 'grid' : 'list';
            try {
                localStorage.setItem(getSearchEnginesDisplayKey(SEARCH_ENGINES_DISPLAY_SURFACE_PINNED), modeFromChip);
            } catch (_) {}
        }
        const slideOutPinnedEligible =
            !!options.animate &&
            m !== 'pinned-right' &&
            wasPinnedRight &&
            !!searchContainer?.classList.contains('focused') &&
            pinnedRightHost &&
            !pinnedRightHost.hidden &&
            !!pinnedRightHost.querySelector('.search-switcher-dropdown') &&
            !document.body.classList.contains('reduced-motion') &&
            !!document.querySelector('.search-container .suggestions-list')?.classList.contains('suggestions-revealed');
        document.body.classList.toggle('search-engine-list-mode-pinned-right', m === 'pinned-right');
        applyPinnedMenuState(m === 'pinned-left', options);
        refreshPinnedRightSwitcherPanel({
            slideInFromSuggestions: m === 'pinned-right' && !!options.animate,
            slideOutPinned: slideOutPinnedEligible,
        });
        syncSearchSwitcherPanelPinToggle();
        if (m === 'pinned-right') {
            closePrimarySearchSwitcherDropdownKeepingSuggestions();
        }
        if (wasPinnedRight && m !== 'pinned-right' && searchInput && searchContainer) {
            searchContainer.classList.add('focused');
            refreshPinnedRightSwitcherPanel();
            if (document.activeElement !== searchInput) {
                focusAfterUnpinPinnedRight = true;
                requestAnimationFrame(() => {
                    try {
                        searchInput.focus({ preventScroll: true });
                    } catch (_) {
                        focusAfterUnpinPinnedRight = false;
                    }
                });
            }
        }
        try {
            const sel = document.getElementById('search-engine-list-mode-select');
            if (sel && sel.value !== m) sel.value = m;
        } catch (_) {}
        if (window === window.top && !document.body.classList.contains('addressbar')) {
            syncSearchEngineListModeNewtabUrlParam(m);
        }
    };
    function toggleSearchSwitcherPanelPin() {
        const cur = getSearchEngineListMode();
        const next = cur === 'pinned-right' ? 'closed' : 'pinned-right';
        let openedSuggestionsForPin = false;
        if (next === 'pinned-right') {
            const revealed = suggestionsList?.classList.contains('suggestions-revealed');
            const focused = searchContainer?.classList.contains('focused');
            if (!revealed || !focused) {
                openedSuggestionsForPin = true;
                searchContainer?.classList.add('focused');
                suggestionsList?.classList.remove('suggestions-suppress-until-typed');
                if (searchInput && !searchInput.value?.trim()) {
                    const label = searchSwitcherButton?.querySelector('.switcher-button-label');
                    const inLocalSourceMode = label && !label.hidden;
                    if (!inLocalSourceMode) {
                        updateSuggestions(DEFAULT_RECENT_SEARCH_SUGGESTION_SEEDS);
                    } else {
                        suggestionsList?.classList.add('suggestions-suppress-until-typed');
                        updateSuggestions([]);
                    }
                }
                suggestionsList?.classList.add('suggestions-revealed');
            }
        }
        applySearchEngineListMode(next, {
            animate: true,
            seedPinnedDisplayFromPrimary: next === 'pinned-right',
        });
        if (openedSuggestionsForPin) {
            openingSuggestionsForPinPanel = true;
            try {
                searchInput?.focus({ preventScroll: true });
            } catch (_) {}
            if (openingSuggestionsForPinPanel) {
                openingSuggestionsForPinPanel = false;
                searchContainer?.classList.add('focused');
                suggestionsList?.classList.add('suggestions-revealed');
                refreshPinnedRightSwitcherPanel();
            }
        }
        /* Do not dispatch synthetic `input` — it re-runs suggestion generation and flickers the panel (e.g. From Firefox) during the clone transition even though the query is unchanged. */
    }
    const searchEngineListModeSelect = document.getElementById('search-engine-list-mode-select');
    let newtabPinFromUrl = false;
    try {
        newtabPinFromUrl = new URLSearchParams(window.location.search).get('newtab')?.toLowerCase() === 'pin';
    } catch (_) {}
    if (searchEngineListModeSelect) {
        const initialListMode = newtabPinFromUrl ? 'pinned-right' : getSearchEngineListMode();
        applySearchEngineListMode(initialListMode, { animate: false });
        try {
            searchEngineListModeSelect.value = initialListMode;
        } catch (_) {}
        if (newtabPinFromUrl) {
            /* Defer until after search-input focus listeners are registered so focused + pinned-right panel run. */
            setTimeout(() => searchInput?.focus(), 0);
        }
        searchEngineListModeSelect.addEventListener('change', () => {
            const next = searchEngineListModeSelect.value;
            logPinMenu('search engine list mode select', { next });
            applySearchEngineListMode(next, {
                animate: true,
                seedPinnedDisplayFromPrimary: next === 'pinned-right',
            });
        });
    }

    if (window !== window.top) {
        window.addEventListener('message', (e) => {
            if (e.data?.type !== 'search-engine-list-mode') return;
            const m = e.data.mode;
            if (m !== 'closed' && m !== 'pinned-left' && m !== 'pinned-right') return;
            applySearchEngineListMode(m, {
                animate: e.data.animate === true,
                seedPinnedDisplayFromPrimary: m === 'pinned-right',
            });
        });
    }

    let addressbarPinnedResizeScheduled = false;
    window.addEventListener('resize', () => {
        if (!document.body.classList.contains('addressbar') || document.body.classList.contains('standalone-search-box')) return;
        if (!document.body.classList.contains('switcher-outside-search-box-enabled')) return;
        if (addressbarPinnedResizeScheduled) return;
        addressbarPinnedResizeScheduled = true;
        requestAnimationFrame(() => {
            addressbarPinnedResizeScheduled = false;
            try {
                syncAddressbarPinnedSwitcherOffset();
            } catch (_) {}
        });
    });

    window.addEventListener('resize', () => {
        try {
            if (pinnedRightHost && !pinnedRightHost.hidden) {
                const dd = pinnedRightHost.querySelector('.search-switcher-dropdown');
                if (dd) syncPinnedRightPanelLayoutAfterAppend(dd);
            }
        } catch (_) {}
    });

    window.addEventListener('prototype-background-swatch-changed', () => {
        if (document.body.classList.contains('addressbar')) return;
        try {
            const chipItem = getDropdownItemMatchingSearchBarChip();
            if (chipItem) syncMainScreenBrandFromSwitcherItem(chipItem);
        } catch (_) {}
    });

    // Handle background colour swatches
    const backgroundSwatches = document.querySelectorAll('.background-swatch');
    if (backgroundSwatches.length) {
        const savedRaw = localStorage.getItem(BACKGROUND_SWATCH_KEY);
        const normalized = normalizePrototypeBackgroundKey(savedRaw);
        applyPrototypeBackgroundSwatch(normalized || DEFAULT_BACKGROUND_SWATCH);
        backgroundSwatches.forEach((btn) => {
            btn.addEventListener('click', () => applyPrototypeBackgroundSwatch(btn.dataset.background));
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
    
    // Icon mappings for trending suggestions (icons/internal-trending.svg)
    const iconMappings = {
        lightning: ['taylor swift', 'trump', 'weather', 'youtube', 'news', 'spotify', 'amazon', 'netflix', 'tiktok'],
        search: []
    };
    
    function getIconForSuggestion(text) {
        try {
            const textLower = text.toLowerCase();
            
            // Check if in search history — same art as switcher “History” / Firefox suggest
            if (isInSearchHistory(text)) {
                return 'icons/internal-clock.svg';
            }
            
            // AI suggestions check for special mappings
            if (aiSuggestionsSet.has(textLower)) {
                // Check if it's a trending-suggestion match (popular / first in sort order)
                if (iconMappings.lightning && iconMappings.lightning.includes(textLower)) {
                    return 'icons/internal-trending.svg';
                } else if (iconMappings.search && iconMappings.search.includes(textLower)) {
                    return 'icons/internal-magnifyingglass.svg';
                }
                return 'icons/internal-magnifyingglass.svg';
            }
            
            // Default recent-search seed icon (matches static iframe markup)
            return 'icons/internal-clock.svg';
        } catch (error) {
            console.error('[ICON] Error in getIconForSuggestion:', error);
            return 'icons/internal-magnifyingglass.svg';
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
        console.log('[SKELETON] showSkeletonLoaders count=' + count);
        
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
        
        console.log('[SKELETON] adding skeletons count=' + count + ' startRow=' + startRowIndex);
        suggestionsContent.insertAdjacentHTML('beforeend', skeletonHTML);
    }
    
    function removeSkeletons() {
        const suggestionsContent = suggestionsList?.querySelector('.suggestions-content');
        if (!suggestionsContent) return;
        
        const skeletons = suggestionsContent.querySelectorAll('.skeleton');
        skeletons.forEach(skeleton => skeleton.remove());
        console.log('[SKELETON] removed skeletons count=' + skeletons.length);
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

    /**
     * Keep predefined / local rows first, then append AI search strings (deduped, case-insensitive).
     * Preserves _firefoxSuggestions from the AI result on the returned array for rendering.
     */
    function mergePredefinedWithAiSuggestions(baseStrings, aiResult, maxStrings = 9) {
        const aiList = Array.isArray(aiResult) ? [...aiResult] : [];
        const firefoxMeta = aiResult && aiResult._firefoxSuggestions;
        const out = [];
        const seen = new Set();
        const add = (s) => {
            if (typeof s !== 'string') return;
            const t = s.trim();
            if (!t) return;
            const k = t.toLowerCase();
            if (seen.has(k)) return;
            seen.add(k);
            out.push(s);
        };
        (baseStrings || []).forEach(add);
        aiList.forEach(add);
        const arr = out.slice(0, maxStrings);
        if (firefoxMeta && firefoxMeta.length) {
            arr._firefoxSuggestions = firefoxMeta;
        }
        return arr;
    }

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
        searchInput.removeAttribute('data-suggestion-suffix-start');
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
                searchInput.setAttribute('data-suggestion-suffix-start', String(typedLen));
            } else {
                searchInput.setSelectionRange(0, suggestionText.length);
                searchInput.setAttribute('data-suggestion-suffix-start', '0');
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
                /* Use lastTypedTextInInput (set in updateSuggestions from the real query), not searchInput.value —
                 * the field may show hover/keyboard-augmented full text, which would make typedLen wrong and select all. */
                const typedPrefix = (lastTypedTextInInput || '').trim() || searchInput.value.trim();
                updateSearchInputForItem(selectedItem, typedPrefix);
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
        try {
            console.log(
                '[UPDATE] updateSuggestions | count=' +
                    (suggestions ? suggestions.length : 0) +
                    ' | suggestions=' +
                    (Array.isArray(suggestions) ? JSON.stringify(suggestions) : String(suggestions))
            );
        } catch (_) {
            console.log('[UPDATE] updateSuggestions (could not stringify suggestions)');
        }
        
        if (!suggestionsList) {
            console.log('[UPDATE] suggestionsList not found, returning early');
            return;
        }
        
        // Remove any existing skeletons
        removeSkeletons();
        
        // Get the suggestions content container
        const suggestionsContent = suggestionsList.querySelector('.suggestions-content');
        if (!suggestionsContent) {
            console.log('[UPDATE] suggestions-content not found');
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
        
        console.log(
            '[UPDATE] typed=' +
                JSON.stringify(searchValueTrimmed) +
                ' | toShow=' +
                suggestionsToShow.length +
                ' | firefoxMetaCount=' +
                firefoxSuggestions.length
        );
        
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
        
        // Firefox type icons (suggestions panel — match switcher “From Firefox” row art)
        const firefoxTypeIcons = {
            tab: 'icons/internal-tab.svg',
            bookmark: 'icons/internal-star.svg',
            history: 'icons/internal-clock.svg',
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
            tooltipPop.innerHTML = `'From Firefox' includes pages from your history, bookmarks, and open tabs, as well as links to trusted sources and the occasional sponsored suggestion. <a href="https://support.mozilla.org/en-US/kb/firefox-suggest" target="_blank" rel="noopener">Learn how Firefox shows relevant content without selling your data</a>`;
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
            console.log('[UPDATE] adding suggestion rows count=' + suggestionsToShow.length);
            
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
                
                // Get appropriate icon (Firefox items: tab / bookmark / history / actions)
                let iconEl;
                if (isFirefoxSuggest) {
                    const firefoxData = firefoxDataByTitle.get((suggestion || '').toLowerCase().trim());
                    const firefoxType = displayType || (firefoxData && firefoxData.type) || 'history';
                    const iconSrc = firefoxTypeIcons[firefoxType] || 'icons/internal-clock.svg';
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
                } else if (isTypedText) {
                    iconEl = document.createElement('img');
                    iconEl.src = 'icons/internal-clock.svg';
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
            
            console.log('[UPDATE] appended suggestion rows count=' + suggestionsToShow.length);
        } else {
            console.log('[UPDATE] no suggestion rows to append');
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
        requestAnimationFrame(() => {
            updateBorderRadius();
            updateSuggestionsRingExtend();
            syncSearchBoxWrapperCornersForSuggestionsPanel();
        });
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
            updateSuggestions(DEFAULT_RECENT_SEARCH_SUGGESTION_SEEDS);
            currentDisplayedSuggestions = [...DEFAULT_RECENT_SEARCH_SUGGESTION_SEEDS];
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
            updateClearButton();
            updateSearchUrlButton();
            updateTypedState();
            searchInput.removeAttribute('data-suggestion-suffix-start');
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
                updateSuggestions(DEFAULT_RECENT_SEARCH_SUGGESTION_SEEDS);
                currentDisplayedSuggestions = [...DEFAULT_RECENT_SEARCH_SUGGESTION_SEEDS];
                return;
            }

            suggestionsList?.classList.remove('suggestions-suppress-until-typed');
            /* Address bar column: panel stays closed on autofocus until click — first typed character opens it like user intent. */
            let addressbarJustUnlockedSuggestions = false;
            if (addressbarColumnIframe && !addressbarSuggestionsOpenEnabled) {
                addressbarSuggestionsOpenEnabled = true;
                addressbarJustUnlockedSuggestions = true;
            }
            if (!suggestionsList?.classList.contains('suggestions-revealed')) {
                suggestionsList?.classList.add('suggestions-revealed');
            }
            if (addressbarJustUnlockedSuggestions) {
                refreshPinnedRightSwitcherPanel();
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
                const hadPredefinedOrLocalSuggestions = currentDisplayedSuggestions.length > 0;
                console.log(
                    '[INPUT] Had predefined/local suggestions before AI:',
                    hadPredefinedOrLocalSuggestions,
                    'count:',
                    currentDisplayedSuggestions.length
                );

                if (hadPredefinedOrLocalSuggestions) {
                    // Filter existing suggestions (pre-defined from suggestionWords, etc.)
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
                            const toShow = hadPredefinedOrLocalSuggestions
                                ? mergePredefinedWithAiSuggestions(currentDisplayedSuggestions, aiSuggestions, 9)
                                : aiSuggestions;
                            console.log(
                                '[AI] Updating with',
                                toShow.length,
                                hadPredefinedOrLocalSuggestions ? 'merged (predefined + AI)' : 'AI-only',
                                'suggestions'
                            );
                            updateSuggestions(toShow, { suppressHover: true });
                            currentDisplayedSuggestions = Array.isArray(toShow) ? [...toShow] : [];
                        } else {
                            console.log('[AI] No AI suggestions returned');
                            if (!hadPredefinedOrLocalSuggestions) {
                                updateSuggestions([]);
                            }
                            /* If we had predefined rows, keep whatever filterExistingSuggestions left in the list. */
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

    /* Static iframe HTML uses `icons/internal-clock.svg` for seed rows; `updateSuggestions` assigns trending / AI icons. Sync on load when the field is empty so first paint matches “clear search”. */
    if (searchInput && suggestionsList) {
        try {
            const label = searchSwitcherButton?.querySelector('.switcher-button-label');
            const inLocalSourceModeOnInit = label && !label.hidden;
            if (!inLocalSourceModeOnInit && !String(searchInput.value || '').trim()) {
                updateSuggestions(DEFAULT_RECENT_SEARCH_SUGGESTION_SEEDS);
                currentDisplayedSuggestions = [...DEFAULT_RECENT_SEARCH_SUGGESTION_SEEDS];
            }
        } catch (_) {}
    }

    if (searchInput && searchContainer) {
        let autoOpenedSwitcherOnFocus = false;

        searchInput.addEventListener('focus', (focusEv) => {
            searchContainer.classList.remove('search-container--suggestions-panel-collapsing');
            if (restoringFocusFromSwitcher) {
                restoringFocusFromSwitcher = false;
                searchContainer.classList.add('focused');
                if (suggestionsList) suggestionsList.classList.add('suggestions-revealed');
                syncSearchBoxWrapperCornersForSuggestionsPanel();
                refreshPinnedRightSwitcherPanel();
                return;
            }
            if (focusAfterUnpinPinnedRight) {
                focusAfterUnpinPinnedRight = false;
                searchContainer.classList.add('focused');
                refreshPinnedRightSwitcherPanel();
                return;
            }
            if (closingSwitcherWithoutSuggestions) {
                closingSwitcherWithoutSuggestions = false;
                searchInput?.blur();
                refreshPinnedRightSwitcherPanel();
                return;
            }
            if (openingSuggestionsForPinPanel) {
                openingSuggestionsForPinPanel = false;
                searchContainer.classList.add('focused');
                if (suggestionsList) suggestionsList.classList.add('suggestions-revealed');
                syncSearchBoxWrapperCornersForSuggestionsPanel();
                refreshPinnedRightSwitcherPanel();
                return;
            }
            if (isRestoringFocus) {
                isRestoringFocus = false;
                searchContainer.classList.add('focused');
                if (suggestionsList) {
                    if (!addressbarColumnIframe || wasAddressbarSuggestionsRevealedAtBlur) {
                        suggestionsList.classList.add('suggestions-revealed');
                    }
                }
                wasAddressbarSuggestionsRevealedAtBlur = false;
                syncSearchBoxWrapperCornersForSuggestionsPanel();
                refreshPinnedRightSwitcherPanel();
                return;
            }
            // Add focused class to expand width
            searchContainer.classList.add('focused');
            suggestionsList?.classList.remove('suggestions-revealed');
            
            // Reset first hover flag
            firstHoverDone = false;
            
            const label = searchSwitcherButton?.querySelector('.switcher-button-label');
            const inLocalSourceMode = label && !label.hidden;
            const inputEmpty = !searchInput?.value?.trim();
            if (inLocalSourceMode && inputEmpty) {
                suggestionsList?.classList.add('suggestions-suppress-until-typed');
                updateSuggestions([]);
                refreshPinnedRightSwitcherPanel();
                return;
            }
            suggestionsList?.classList.remove('suggestions-suppress-until-typed');
            syncSearchBoxWrapperCornersForSuggestionsPanel();

            if (addressbarColumnIframe && !addressbarSuggestionsOpenEnabled) {
                /* Autofocus from load: relatedTarget is null — keep panel closed until click.
                 * Tab from another control: relatedTarget is set — treat as intentional navigation. */
                if (focusEv.relatedTarget != null) {
                    addressbarSuggestionsOpenEnabled = true;
                } else {
                    refreshPinnedRightSwitcherPanel();
                    return;
                }
            }

            // Disable hover states during transition
            if (suggestionsList) {
                suggestionsList.classList.add('transitioning');
                if (addressbarColumnIframe) {
                    /* Address-bar CSS keeps max-height at 0 until .suggestions-revealed, so nothing animates and
                     * transitionend would never add the class. Apply it here so 0 → expanded can run. */
                    suggestionsList.classList.add('suggestions-revealed');
                }
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
            refreshPinnedRightSwitcherPanel();
        });
        
        searchInput.addEventListener('blur', (e) => {
            if (inspectSuggestions) return;
            if (addressbarColumnIframe) {
                wasAddressbarSuggestionsRevealedAtBlur = !!suggestionsList?.classList.contains('suggestions-revealed');
            }
            // Pinned-right panel is beside the pill; focus moves into it on click — not "left search".
            if (e.relatedTarget?.closest?.('.search-switcher-pinned-right-host')) {
                return;
            }
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
                requestAnimationFrame(() => {
                    if (window.__prototypeOptionsBlurSuppressUntil && Date.now() < window.__prototypeOptionsBlurSuppressUntil) {
                        return;
                    }
                    if (document.activeElement?.closest?.('.bottom-left-panel')) {
                        return;
                    }
                    if (document.activeElement?.closest?.('.search-switcher-pinned-right-host')) {
                        return;
                    }
                    if (pinnedRightHostPointerActive) {
                        return;
                    }
                    /* App / tab switch: input blurs before the window is inactive; don't remove .focused or the hero
                     * reverts to full size and re-animates when returning. Real in-page blur still has document focus. */
                    if (!document.body.classList.contains('addressbar') && !document.hasFocus()) {
                        return;
                    }
                    closeSuggestionsPanel();
                });
            }, 0);
        });

        if (addressbarColumnIframe) {
            searchContainer.addEventListener(
                'pointerdown',
                () => {
                    addressbarSuggestionsOpenEnabled = true;
                    refreshPinnedRightSwitcherPanel();
                    /* If focus ran before pointerdown, the focus handler returned early and never attached the
                     * reveal path — open once pointerdown catches up. */
                    if (
                        document.activeElement === searchInput &&
                        searchContainer.classList.contains('focused') &&
                        suggestionsList &&
                        !suggestionsList.classList.contains('suggestions-revealed')
                    ) {
                        requestAnimationFrame(() => {
                            if (document.activeElement !== searchInput || !searchContainer.classList.contains('focused')) {
                                return;
                            }
                            if (suggestionsList.classList.contains('suggestions-revealed')) return;
                            suggestionsList.classList.add('transitioning');
                            suggestionsList.classList.add('suggestions-revealed');
                            setTimeout(() => {
                                suggestionsList.classList.remove('transitioning');
                                suggestionsList.classList.add('first-hover-fade');
                            }, 420);
                            syncSearchBoxWrapperCornersForSuggestionsPanel();
                            refreshPinnedRightSwitcherPanel();
                        });
                    }
                },
                true
            );
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    try {
                        searchInput.focus({ preventScroll: true });
                    } catch (_) {
                        try {
                            searchInput.focus();
                        } catch (_) {}
                    }
                });
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

        if (clearCacheButton && window === window.top && !document.body.classList.contains('addressbar')) {
            clearCacheButton.addEventListener('click', async () => {
                clearCacheButton.disabled = true;
                try {
                    // Reset prototype settings, but preserve "recent searches" to simulate an in-use browser.
                    const preservedSearchHistory = localStorage.getItem('search_history');

                    const keysToRemove = [
                        'ai_provider',
                        'reduced_motion_enabled',
                        PROTOTYPE_BROWSER_CHROME_VISIBLE_KEY,
                        BACKGROUND_SWATCH_KEY,
                        'pale_grey_background_enabled',
                        SEARCH_BORDER_COLOR_KEY,
                        SEARCH_BORDER_RADIUS_MODE_KEY,
                        'gradient_search_border_enabled',
                        PIN_DEFAULT_SEARCH_ENGINE_ENABLED_KEY,
                        SEARCH_SWITCHER_CONTROLS_VISIBLE_BY_DEFAULT_KEY,
                        UNDERLINE_SEARCH_ENGINES_ENABLED_KEY,
                        KEYBOARD_SWITCHER_NUMBERS_ENABLED_KEY,
                        MAIN_SCREEN_HERO_LOGO_MODE_KEY,
                        MAIN_SCREEN_BRAND_STRAPLINE_DISMISSED_KEY,
                        DISMISSABLE_STRAPLINE_ENABLED_KEY,
                        TWELVE_SEARCH_ENGINES_ENABLED_KEY,
                        SEARCH_ENGINES_COUNT_KEY,
                        SEARCH_ENGINE_LIST_MODE_KEY,
                        SEARCH_ENGINE_LIST_MODE_KEY_ADDRESSBAR,
                        SWITCHER_OUTSIDE_SEARCH_BOX_ENABLED_KEY,
                        STANDALONE_SEARCH_BOX_VISIBLE_KEY,
                        QUICK_BUTTONS_VISIBLE_KEY,
                        SEARCH_ENGINE_ORDER_KEY,
                        SEARCH_SETTINGS_NAVIGATE_NEW_TAB_KEY,
                        SEARCH_SETTINGS_NAVIGATE_PRIVATE_KEY,
                        SEARCH_SETTINGS_SEARCH_ADDRESS_BAR_KEY,
                        FIREFOX_SUGGESTIONS_ENABLED_KEY,
                        'inspectSuggestions'
                    ];
                    console.log(
                        '[prototype-reset] started | preservedSearchHistory=' +
                            String(preservedSearchHistory != null) +
                            ' | clearingLocalStorageKeys=' +
                            JSON.stringify(keysToRemove)
                    );
                    keysToRemove.forEach((k) => {
                        try {
                            localStorage.removeItem(k);
                        } catch (_) {}
                    });
                    syncSearchSettingsModalUrlParam(false);
                    try {
                        closeSearchSettingsModal();
                    } catch (_) {}
                    try {
                        localStorage.setItem(SEARCH_ENGINE_LIST_MODE_KEY, 'closed');
                        localStorage.setItem(SWITCHER_OUTSIDE_SEARCH_BOX_ENABLED_KEY, 'false');
                    } catch (_) {}
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
                    console.log('[prototype-reset] localStorage keys cleared; default search engines set to Google (main / address bar / standalone)');

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
                        applyCanonicalSearchEngineOrder(enginesContainerReset, sortSection);
                        /* Apply the stored default (Google above), not the previous `.dropdown-item-pinned` row. */
                        applySearchSwitcherUIFromStoredDefault();
                        ensureRowActions();
                        updateKeyboardNumbers();
                        updateReorderResetButtonState();
                        console.log(
                            '[prototype-reset] main page search switcher engine order after DOM reset | input=' +
                                getDefaultSearchEngineSurfaceLabel() +
                                ' | engineListOrder=' +
                                JSON.stringify(
                                    getSearchEngineListOrderFromSwitcherButton(searchSwitcherButton)
                                )
                        );
                    }
                    syncSearchSettingsDefaultEngineSelects();
                    document.querySelectorAll('#search-settings-modal .search-settings-cell-checkbox').forEach((cb) => {
                        cb.checked = !cb.classList.contains('search-settings-navigate-column-checkbox');
                    });
                    applySwitcherFromFirefoxSectionVisibility();

                    if (reducedMotionCheckbox) {
                        reducedMotionCheckbox.checked = false;
                        document.body.classList.remove('reduced-motion');
                    }
                    document.body.classList.remove('browser-chrome-hidden');
                    document.body.classList.remove('prototype-iframe-debug-borders');
                    const prototypeBrowserChromeCbReset = document.querySelector('.prototype-browser-chrome-checkbox');
                    if (prototypeBrowserChromeCbReset) prototypeBrowserChromeCbReset.checked = true;
                    syncPrototypeBrowserChromeUrlParam(true);
                    document.body.classList.remove('prototype-new-tab-content-hidden');
                    const prototypeShowNewTabCbReset = document.querySelector('.prototype-show-new-tab-content-checkbox');
                    if (prototypeShowNewTabCbReset) prototypeShowNewTabCbReset.checked = true;
                    syncPrototypeNewTabContentUrlParam(true);
                    document.body.classList.remove('pin-default-enabled');
                    updateDefaultBadge();

                    document.querySelectorAll('input[name="search-engines-count"]').forEach((radio) => {
                        radio.checked = radio.value === '6';
                    });
                    try {
                        getDefaultSearchEngineLocalStorage().setItem(SEARCH_ENGINES_COUNT_KEY, '6');
                    } catch (_) {}
                    applySearchEnginesCountMode(6);

                    applySearchSwitcherControlsVisibleLayout();
                    try {
                        localStorage.setItem(
                            getSearchEnginesDisplayKey(SEARCH_ENGINES_DISPLAY_SURFACE_PRIMARY),
                            'list'
                        );
                        localStorage.setItem(
                            getSearchEnginesDisplayKey(SEARCH_ENGINES_DISPLAY_SURFACE_PINNED),
                            'list'
                        );
                    } catch (_) {}
                    applySearchEnginesDisplayMode(undefined, 'all');

                    applyStandaloneSearchBoxPrototypeVisibility(false);

                    applyPrototypeBackgroundSwatch(DEFAULT_BACKGROUND_SWATCH);

                    applyMainScreenHeroLogoMode(DEFAULT_MAIN_SCREEN_HERO_LOGO_MODE);
                    try {
                        localStorage.setItem(MAIN_SCREEN_HERO_LOGO_MODE_KEY, DEFAULT_MAIN_SCREEN_HERO_LOGO_MODE);
                    } catch (_) {}
                    document.body.classList.remove('dismissable-strapline-enabled');
                    const dismissableStraplineCbReset = document.querySelector('.dismissable-strapline-checkbox');
                    if (dismissableStraplineCbReset) dismissableStraplineCbReset.checked = false;
                    const straplineRowAfterReset = document.querySelector('.main-screen-brand-firefox-row');
                    if (straplineRowAfterReset) straplineRowAfterReset.hidden = false;
                    syncMainScreenHeroLogoRadiosToMode(DEFAULT_MAIN_SCREEN_HERO_LOGO_MODE);
                    const pinnedHeroReset = searchSwitcherButton?.querySelector('.dropdown-search-engines .dropdown-item-pinned');
                    if (pinnedHeroReset) syncMainScreenBrandFromSwitcherItem(pinnedHeroReset);

                    persistSearchBorderColorForPrototype(SEARCH_BORDER_COLOR_DEFAULT);
                    try {
                        localStorage.setItem(SEARCH_BORDER_RADIUS_MODE_KEY, 'small');
                    } catch (_) {}
                    refreshSearchBorderRadiusMode();

                    const underlineCbReset = document.querySelector('.underline-search-engines-checkbox');
                    if (underlineCbReset) underlineCbReset.checked = false;
                    clearEngineInitialUnderlines();

                    const kbdCbReset = document.querySelector('.keyboard-switcher-numbers-checkbox');
                    if (kbdCbReset) {
                        kbdCbReset.checked = true;
                        document.body.classList.add('keyboard-switcher-numbers-enabled');
                    }

                    applySearchEngineListMode('closed', { animate: false });

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
                        const suggestionsToShow = history.length
                            ? history.slice(0, 8)
                            : [...DEFAULT_RECENT_SEARCH_SUGGESTION_SEEDS];
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
                        try {
                            f.contentWindow?.postMessage(
                                { type: 'clear-local-storage-key', key: SEARCH_ENGINE_ORDER_KEY },
                                '*'
                            );
                            f.contentWindow?.postMessage({ type: 'search-engine-list-mode', mode: 'closed' }, '*');
                        } catch (_) {}
                    });
                    [iframeReset, standaloneIframeReset].filter(Boolean).forEach((f) => {
                        const src = f.getAttribute('src');
                        if (src) f.src = src;
                    });
                    console.log(
                        '[prototype-reset] reloaded embedded search iframes (address bar / standalone). Open each switcher to log [search-switcher] with engineListOrder.'
                    );

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
    
    // Delete/Backspace while a suggestion ghost suffix is selected → restore typed query only (capture so it runs before local-source handler)
    if (searchInput && suggestionsList) {
        searchInput.addEventListener('keydown', (event) => {
            if (event.key !== 'Backspace' && event.key !== 'Delete') return;
            const suffixStartAttr = searchInput.getAttribute('data-suggestion-suffix-start');
            if (suffixStartAttr === null) return;
            const suffixStart = parseInt(suffixStartAttr, 10);
            if (Number.isNaN(suffixStart)) {
                searchInput.removeAttribute('data-suggestion-suffix-start');
                return;
            }
            const selStart = searchInput.selectionStart ?? 0;
            const selEnd = searchInput.selectionEnd ?? 0;
            if (selEnd <= selStart || selStart !== suffixStart) return;
            event.preventDefault();
            const restore = lastTypedTextInInput ?? '';
            searchInput.value = restore;
            searchInput.removeAttribute('data-suggestion-suffix-start');
            searchInput.setSelectionRange(restore.length, restore.length);
            hoveredSuggestionIndex = -1;
            selectedSuggestionIndex = -1;
            lastHoveredItemForInput = null;
            updateSelectedSuggestion(false);
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }, true);
    }

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
                let hoverIdx = -1;
                const suggestionsContent = suggestionsList.querySelector('.suggestions-content');
                if (suggestionsContent) {
                    const items = suggestionsContent.querySelectorAll('.suggestion-item:not(.skeleton):not(.gmail-item-hidden)');
                    hoverIdx = Array.from(items).indexOf(item);
                    if (hoverIdx >= 0) hoveredSuggestionIndex = hoverIdx;
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
                    searchInput.removeAttribute('data-suggestion-suffix-start');
                    searchInput.setSelectionRange(lastTypedTextInInput.length, lastTypedTextInInput.length);
                }
            }
        });
    }
    
    // Maintain focus state when switching apps
    let wasFocusedBeforeBlur = false;
    let wasSwitcherFocusedBeforeBlur = false;
    let isRestoringFocus = false;
    /** Address bar column: window focus restore must not open suggestions unless they were open before blur. */
    let wasAddressbarSuggestionsRevealedAtBlur = false;
    
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
                if (addressbarColumnIframe) {
                    wasAddressbarSuggestionsRevealedAtBlur = !!suggestionsList?.classList.contains('suggestions-revealed');
                }
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
                const logo = document.querySelector('.main-screen-brand-logos');
                if (logo) logo.style.transition = 'none';
                const heroWordmarkSlot = document.querySelector('.main-screen-engine-wordmark-slot');
                const heroStraplineRow = document.querySelector('.main-screen-brand-firefox-row');
                if (heroWordmarkSlot) heroWordmarkSlot.style.transition = 'none';
                if (heroStraplineRow) heroStraplineRow.style.transition = 'none';
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
                    if (heroWordmarkSlot) heroWordmarkSlot.style.transition = '';
                    if (heroStraplineRow) heroStraplineRow.style.transition = '';
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

    try {
        applySearchInputPlaceholderFromAccessPointSettings(null);
    } catch (_) {}
});
