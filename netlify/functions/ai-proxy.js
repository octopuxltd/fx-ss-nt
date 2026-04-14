/**
 * Server-side proxy for OpenAI / OpenRouter / Anthropic chat APIs so the browser
 * avoids CORS (providers do not allow arbitrary web origins on the public APIs).
 *
 * Env (set in Netlify UI, same names as build): OPENAI_API_KEY, OPENROUTER_API_KEY, CLAUDE_API_KEY
 * Optional: AI_PROXY_EXTRA_ORIGINS=comma,separated,exact,origins
 *           AI_PROXY_ALLOW_NULL_ORIGIN=1  (file:// sends Origin: null — off by default)
 *           AI_PROXY_CACHE=0            (disable shared response cache; default on when Blobs work)
 *           AI_PROXY_CACHE_TTL_MS=31536000000  (cache entry max age in ms; default 365d)
 *
 * Suggestion traffic uses a semantic Blobs key (query + kind) so cache hits do not require the
 * same provider/model/payload; search caches keep the longest string list per query so a later
 * request for fewer suggestions can be served from a larger cached list.
 */
'use strict';

const crypto = require('crypto');

/** Default Blobs TTL when AI_PROXY_CACHE_TTL_MS is unset (prototype: staleness OK). */
const DEFAULT_AI_PROXY_CACHE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

const BLOBS_STORE_NAME = 'ai-proxy-responses';
const SEMANTIC_CACHE_VERSION = 2;

let blobsApi = null;
try {
    blobsApi = require('@netlify/blobs');
} catch (_) {
    /* optional until npm install */
}

/** Netlify / CI secrets often include a trailing newline — OpenAI returns 401 "Incorrect API key". */
function envKey(name) {
    const v = process.env[name];
    if (v == null) return '';
    return String(v).trim();
}

function extraOrigins() {
    const raw = process.env.AI_PROXY_EXTRA_ORIGINS || '';
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function isOriginAllowed(origin) {
    if (!origin) return false;
    if (origin === 'null') {
        return process.env.AI_PROXY_ALLOW_NULL_ORIGIN === '1';
    }
    if (extraOrigins().includes(origin)) return true;
    if (/^https:\/\/[\w.-]+\.netlify\.app$/i.test(origin)) return true;
    if (/^http:\/\/localhost(:\d+)?$/i.test(origin)) return true;
    if (/^http:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin)) return true;
    if (/^http:\/\/\[::1\](:\d+)?$/i.test(origin)) return true;
    return false;
}

function requestOrigin(event) {
    const o = event.headers.origin || event.headers.Origin;
    if (o) return o;
    const ref = event.headers.referer || event.headers.Referer;
    if (ref) {
        try {
            return new URL(ref).origin;
        } catch (_) {}
    }
    return '';
}

function corsHeaders(origin) {
    if (!isOriginAllowed(origin)) return null;
    const allow = origin === 'null' ? 'null' : origin;
    return {
        'Access-Control-Allow-Origin': allow,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        Vary: 'Origin',
    };
}

function cacheEnabled() {
    const v = (process.env.AI_PROXY_CACHE || '').toLowerCase();
    if (v === '0' || v === 'false' || v === 'off') return false;
    return !!(blobsApi && typeof blobsApi.connectLambda === 'function' && typeof blobsApi.getStore === 'function');
}

function cacheTtlMs() {
    const raw = parseInt(String(process.env.AI_PROXY_CACHE_TTL_MS || '').trim(), 10);
    if (Number.isFinite(raw) && raw > 0) return raw;
    return DEFAULT_AI_PROXY_CACHE_TTL_MS;
}

/** Legacy: exact provider + body hash (warm-up and non-matching prompts). */
function legacyCacheKey(provider, upstreamBody) {
    return crypto.createHash('sha256').update(`${provider}\n${upstreamBody}`, 'utf8').digest('hex');
}

function gatherPromptText(payload) {
    if (!payload || typeof payload !== 'object') return '';
    const parts = [];
    if (typeof payload.system === 'string' && payload.system.trim()) {
        parts.push(payload.system);
    }
    const msgs = Array.isArray(payload.messages) ? payload.messages : [];
    for (const m of msgs) {
        if (m && typeof m.content === 'string' && m.content.trim()) {
            parts.push(m.content);
        }
    }
    return parts.join('\n');
}

/**
 * Detect Firefox prototype vs search-suggestion prototype prompts from step1.js.
 * @returns {{ kind: 'search', query: string, searchCount: number } | { kind: 'firefox', query: string } | null}
 */
function classifyPrototypeAiRequest(payload) {
    const text = gatherPromptText(payload);
    if (!text) return null;

    const fx = text.match(/Generate\s+4\s+Firefox\s+suggestions\s+related\s+to\s+"([^"]{0,500})"/i);
    if (fx) {
        const query = String(fx[1] || '')
            .trim()
            .toLowerCase();
        if (query) return { kind: 'firefox', query };
    }

    const sc = text.match(
        /Generate\s+(\d+)\s+popular\s+search\s+suggestions\s+where\s+at\s+least\s+one\s+word\s+starts\s+with:\s*"([^"]{0,500})"/i
    );
    if (sc) {
        const n = parseInt(String(sc[1] || '').trim(), 10);
        const query = String(sc[2] || '')
            .trim()
            .toLowerCase();
        if (query && Number.isFinite(n) && n > 0 && n <= 80) {
            return { kind: 'search', query, searchCount: n };
        }
    }

    return null;
}

function semanticBlobKey(kind, queryNorm) {
    const h = crypto.createHash('sha256').update(`${kind}:${queryNorm}`, 'utf8').digest('hex');
    return `v${SEMANTIC_CACHE_VERSION}/${kind}/${h}`;
}

function parseAssistantContent(provider, upstreamJsonText) {
    try {
        const data = JSON.parse(upstreamJsonText);
        if (provider === 'claude') {
            const t = data.content && data.content[0] && data.content[0].text;
            return typeof t === 'string' ? t.trim() : null;
        }
        const c = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        return typeof c === 'string' ? c.trim() : null;
    } catch (_) {
        return null;
    }
}

function parseSearchStringArrayFromAssistant(content) {
    if (!content || typeof content !== 'string') return null;
    const tryParse = (s) => {
        try {
            const v = JSON.parse(s);
            if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string')) {
                return v.map((x) => x.trim()).filter(Boolean);
            }
        } catch (_) {}
        return null;
    };
    let r = tryParse(content);
    if (r) return r;
    const m = content.match(/\[[\s\S]*?\]/);
    if (m) {
        r = tryParse(m[0]);
        if (r) return r;
    }
    return null;
}

function normalizeFirefoxItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const title = String(raw.title ?? raw.Title ?? raw.name ?? '').trim();
    if (!title) return null;
    const url = String(raw.url ?? raw.URL ?? raw.link ?? '').trim();
    const description = String(raw.description ?? raw.Description ?? raw.meta ?? '').trim();
    return { title, url, description };
}

function parseFirefoxArrayFromAssistant(content) {
    const arr = parseInnerJsonArray(content);
    if (!Array.isArray(arr)) return null;
    const out = arr.map(normalizeFirefoxItem).filter(Boolean);
    return out.length ? out : null;
}

function parseInnerJsonArray(content) {
    if (!content || typeof content !== 'string') return null;
    const tryParse = (s) => {
        try {
            const v = JSON.parse(s);
            return Array.isArray(v) ? v : null;
        } catch (_) {
            return null;
        }
    };
    let v = tryParse(content);
    if (v) return v;
    const m = content.match(/\[[\s\S]*\]/);
    if (m) {
        v = tryParse(m[0]);
        if (v) return v;
    }
    return null;
}

function longerStringArray(a, b) {
    const aa = Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()) : [];
    const bb = Array.isArray(b) ? b.filter((x) => typeof x === 'string' && x.trim()) : [];
    return bb.length > aa.length ? bb : aa;
}

function longerFirefoxArray(a, b) {
    const aa = Array.isArray(a) ? a : [];
    const bb = Array.isArray(b) ? b : [];
    return bb.length > aa.length ? bb : aa;
}

function syntheticUpstreamBody(provider, payload, assistantInnerText) {
    const model =
        (payload && typeof payload.model === 'string' && payload.model.trim()) || 'netlify-cache';
    if (provider === 'claude') {
        return JSON.stringify({
            id: 'msg_netlify_semantic_cache',
            type: 'message',
            role: 'assistant',
            model,
            content: [{ type: 'text', text: assistantInnerText }],
            stop_reason: 'end_turn',
        });
    }
    return JSON.stringify({
        id: 'chatcmpl_netlify_semantic_cache',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
            {
                index: 0,
                message: { role: 'assistant', content: assistantInnerText },
                finish_reason: 'stop',
            },
        ],
    });
}

exports.handler = async (event) => {
    const origin = requestOrigin(event);
    const cors = corsHeaders(origin);

    if (event.httpMethod === 'OPTIONS') {
        if (!cors) {
            return { statusCode: 403, body: 'Forbidden' };
        }
        return { statusCode: 204, headers: cors };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'text/plain', ...(cors || {}) },
            body: 'Method Not Allowed',
        };
    }

    if (!cors) {
        return {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Origin not allowed for AI proxy' }),
        };
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (_) {
        return {
            statusCode: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Invalid JSON body' }),
        };
    }

    const { provider, payload } = body;
    if (!provider || typeof payload !== 'object' || payload === null) {
        return {
            statusCode: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Expected { provider, payload }' }),
        };
    }

    let upstreamUrl;
    /** @type {Record<string, string>} */
    const headers = { 'Content-Type': 'application/json' };
    const upstreamBody = JSON.stringify(payload);

    if (provider === 'openai') {
        const key = envKey('OPENAI_API_KEY');
        if (!key) {
            return {
                statusCode: 500,
                headers: { ...cors, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Server missing OPENAI_API_KEY' }),
            };
        }
        upstreamUrl = OPENAI_URL;
        headers.Authorization = `Bearer ${key}`;
    } else if (provider === 'openrouter') {
        const key = envKey('OPENROUTER_API_KEY');
        if (!key) {
            return {
                statusCode: 500,
                headers: { ...cors, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Server missing OPENROUTER_API_KEY' }),
            };
        }
        upstreamUrl = OPENROUTER_URL;
        headers.Authorization = `Bearer ${key}`;
        headers['HTTP-Referer'] = origin && origin !== 'null' ? origin : 'https://netlify.app';
        headers['X-Title'] = 'Search Suggestions';
    } else if (provider === 'claude') {
        const key = envKey('CLAUDE_API_KEY');
        if (!key) {
            return {
                statusCode: 500,
                headers: { ...cors, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Server missing CLAUDE_API_KEY' }),
            };
        }
        upstreamUrl = CLAUDE_URL;
        headers['x-api-key'] = key;
        headers['anthropic-version'] = '2023-06-01';
    } else {
        return {
            statusCode: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Unknown provider' }),
        };
    }

    const ttl = cacheTtlMs();
    let store = null;
    if (cacheEnabled()) {
        try {
            blobsApi.connectLambda(event);
            store = blobsApi.getStore(BLOBS_STORE_NAME);
        } catch (err) {
            console.warn('[ai-proxy] Blobs init failed, cache disabled:', err && err.message ? err.message : err);
        }
    }

    const semantic = classifyPrototypeAiRequest(payload);
    const semanticKey = store && semantic ? semanticBlobKey(semantic.kind, semantic.query) : null;
    const legacyKey = store ? legacyCacheKey(provider, upstreamBody) : null;

    /** @type {string} */
    let cacheHeader = '';

    if (store && semantic && semanticKey) {
        try {
            const entry = await store.get(semanticKey, { type: 'json' });
            if (
                entry &&
                entry.v === SEMANTIC_CACHE_VERSION &&
                typeof entry.storedAt === 'number' &&
                Date.now() - entry.storedAt < ttl
            ) {
                if (semantic.kind === 'search') {
                    const arr = entry.searchStrings;
                    if (
                        Array.isArray(arr) &&
                        arr.length >= semantic.searchCount &&
                        arr.every((x) => typeof x === 'string')
                    ) {
                        const slice = arr.slice(0, semantic.searchCount);
                        const inner = JSON.stringify(slice);
                        const body = syntheticUpstreamBody(provider, payload, inner);
                        cacheHeader = 'hit';
                        return {
                            statusCode: 200,
                            headers: {
                                ...cors,
                                'Content-Type': 'application/json',
                                'X-AI-Proxy-Cache': cacheHeader,
                            },
                            body,
                        };
                    }
                } else if (semantic.kind === 'firefox') {
                    const arr = entry.firefoxItems;
                    if (Array.isArray(arr) && arr.length > 0) {
                        const inner = JSON.stringify(arr);
                        const body = syntheticUpstreamBody(provider, payload, inner);
                        cacheHeader = 'hit';
                        return {
                            statusCode: 200,
                            headers: {
                                ...cors,
                                'Content-Type': 'application/json',
                                'X-AI-Proxy-Cache': cacheHeader,
                            },
                            body,
                        };
                    }
                }
            }
        } catch (err) {
            console.warn('[ai-proxy] semantic cache read error:', err && err.message ? err.message : err);
        }
    }

    if (store && legacyKey && !semantic) {
        try {
            const entry = await store.get(legacyKey, { type: 'json' });
            if (entry && typeof entry.storedAt === 'number' && typeof entry.body === 'string') {
                if (Date.now() - entry.storedAt < ttl) {
                    const ct = entry.contentType || 'application/json';
                    return {
                        statusCode: entry.statusCode || 200,
                        headers: {
                            ...cors,
                            'Content-Type': ct,
                            'X-AI-Proxy-Cache': 'hit',
                        },
                        body: entry.body,
                    };
                }
            }
        } catch (err) {
            console.warn('[ai-proxy] legacy cache read error:', err && err.message ? err.message : err);
        }
    }

    let upstreamRes;
    try {
        upstreamRes = await fetch(upstreamUrl, {
            method: 'POST',
            headers,
            body: upstreamBody,
        });
    } catch (err) {
        return {
            statusCode: 502,
            headers: { ...cors, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: String(err && err.message ? err.message : err) }),
        };
    }

    const text = await upstreamRes.text();
    const ct = upstreamRes.headers.get('content-type') || 'application/json';

    if (store && upstreamRes.ok && upstreamRes.status >= 200 && upstreamRes.status < 300) {
        try {
            if (semantic && semanticKey) {
                const assistant = parseAssistantContent(provider, text);
                if (semantic.kind === 'search') {
                    const parsed = assistant ? parseSearchStringArrayFromAssistant(assistant) : null;
                    if (parsed && parsed.length > 0) {
                        const prev = await store.get(semanticKey, { type: 'json' });
                        const prevArr =
                            prev && prev.v === SEMANTIC_CACHE_VERSION && Array.isArray(prev.searchStrings)
                                ? prev.searchStrings
                                : [];
                        const merged = longerStringArray(prevArr, parsed);
                        await store.setJSON(semanticKey, {
                            v: SEMANTIC_CACHE_VERSION,
                            storedAt: Date.now(),
                            kind: 'search',
                            query: semantic.query,
                            searchStrings: merged,
                        });
                    }
                } else if (semantic.kind === 'firefox') {
                    const parsed = assistant ? parseFirefoxArrayFromAssistant(assistant) : null;
                    if (parsed && parsed.length > 0) {
                        const prev = await store.get(semanticKey, { type: 'json' });
                        const prevArr =
                            prev && prev.v === SEMANTIC_CACHE_VERSION && Array.isArray(prev.firefoxItems)
                                ? prev.firefoxItems
                                : [];
                        const merged = longerFirefoxArray(prevArr, parsed);
                        await store.setJSON(semanticKey, {
                            v: SEMANTIC_CACHE_VERSION,
                            storedAt: Date.now(),
                            kind: 'firefox',
                            query: semantic.query,
                            firefoxItems: merged,
                        });
                    }
                }
            } else if (legacyKey) {
                await store.setJSON(legacyKey, {
                    storedAt: Date.now(),
                    statusCode: upstreamRes.status,
                    contentType: ct,
                    body: text,
                });
            }
        } catch (err) {
            console.warn('[ai-proxy] cache write error:', err && err.message ? err.message : err);
        }
    }

    const missHeader =
        store && (semanticKey || (!semantic && legacyKey)) ? { 'X-AI-Proxy-Cache': 'miss' } : {};

    return {
        statusCode: upstreamRes.status,
        headers: {
            ...cors,
            'Content-Type': ct,
            ...missHeader,
        },
        body: text,
    };
};
