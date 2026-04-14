/**
 * Server-side proxy for OpenAI / OpenRouter / Anthropic chat APIs so the browser
 * avoids CORS (providers do not allow arbitrary web origins on the public APIs).
 *
 * Env (set in Netlify UI, same names as build): OPENAI_API_KEY, OPENROUTER_API_KEY, CLAUDE_API_KEY
 * Optional: AI_PROXY_EXTRA_ORIGINS=comma,separated,exact,origins
 *           AI_PROXY_ALLOW_NULL_ORIGIN=1  (file:// sends Origin: null — off by default)
 */
'use strict';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

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
    let upstreamBody = JSON.stringify(payload);

    if (provider === 'openai') {
        const key = process.env.OPENAI_API_KEY;
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
        const key = process.env.OPENROUTER_API_KEY;
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
        const key = process.env.CLAUDE_API_KEY;
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

    return {
        statusCode: upstreamRes.status,
        headers: {
            ...cors,
            'Content-Type': ct,
        },
        body: text,
    };
};
