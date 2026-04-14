/**
 * Server-side proxy for OpenAI / OpenRouter / Anthropic chat APIs so the browser
 * avoids CORS (providers do not allow arbitrary web origins on the public APIs).
 *
 * Env (set in Netlify UI, same names as build): OPENAI_API_KEY, OPENROUTER_API_KEY, CLAUDE_API_KEY
 * Optional: AI_PROXY_EXTRA_ORIGINS=comma,separated,exact,origins
 *           AI_PROXY_ALLOW_NULL_ORIGIN=1  (file:// sends Origin: null — off by default)
 *           AI_PROXY_CACHE=0            (disable shared response cache; default on when Blobs work)
 *           AI_PROXY_CACHE_TTL_MS=86400000  (cache entry max age in ms; default 24h)
 */
'use strict';

const crypto = require('crypto');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

const BLOBS_STORE_NAME = 'ai-proxy-responses';

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
    return 24 * 60 * 60 * 1000;
}

function cacheKey(provider, upstreamBody) {
    return crypto.createHash('sha256').update(`${provider}\n${upstreamBody}`, 'utf8').digest('hex');
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

    const key = store ? cacheKey(provider, upstreamBody) : null;

    if (store && key) {
        try {
            const entry = await store.get(key, { type: 'json' });
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
            console.warn('[ai-proxy] cache read error:', err && err.message ? err.message : err);
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

    if (store && key && upstreamRes.ok && upstreamRes.status >= 200 && upstreamRes.status < 300) {
        try {
            await store.setJSON(key, {
                storedAt: Date.now(),
                statusCode: upstreamRes.status,
                contentType: ct,
                body: text,
            });
        } catch (err) {
            console.warn('[ai-proxy] cache write error:', err && err.message ? err.message : err);
        }
    }

    return {
        statusCode: upstreamRes.status,
        headers: {
            ...cors,
            'Content-Type': ct,
            ...(store && key ? { 'X-AI-Proxy-Cache': 'miss' } : {}),
        },
        body: text,
    };
};
