#!/usr/bin/env node
/**
 * Fetches brand-colored SVGs (Simple Icons CDN) into favicons/colorful/.
 * Run from repo root: node scripts/fetch-colorful-favicons.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'favicons', 'colorful');

/** [outputFilename, cdnSlug, hexWithoutHash] — hex optional (SI default). */
const rows = [
    ['Airbnb.svg', 'airbnb', 'FF5A5F'],
    ['AllRecipes.svg', null, null], // already multicolor in repo
    ['AllTrails.svg', 'alltrails', '142601'],
    ['Bluesky.svg', 'bluesky', '1185FE'],
    ['CBC.svg', 'cbc', 'E60505'],
    ['Chess.com.svg', 'chessdotcom', '81B64C'],
    ['Discord.svg', 'discord', '5865F2'],
    ['Duolingo.svg', 'duolingo', '58CC02'],
    ['Etsy.svg', 'etsy', 'F16521'],
    ['Figma.svg', 'figma', 'F24E1E'],
    ['GitHub.svg', 'github', '181713'],
    ['Goodreads.svg', 'goodreads', '553311'],
    ['IMDb.svg', 'imdb', 'F5C518'],
    ['Instagram.svg', 'instagram', 'E4405F'],
    ['Internet Archive.svg', 'internetarchive', 'F47421'],
    ['Itch.io.svg', 'itchdotio', 'FA5C5C'],
    ['Khan Academy.svg', 'khanacademy', '14BF96'],
    ['Kickstarter.svg', 'kickstarter', '05CE78'],
    ['Letterboxd.svg', 'letterboxd', '00D735'],
    ['Lichess.svg', 'lichess', '629137'],
    ['Linear.svg', 'linear', '5E6AD2'],
    ['Mastodon.svg', 'mastodon', '6364FF'],
    ['MyAnimeList.svg', 'myanimelist', '2E51A2'],
    ['NewYorkTimes.svg', 'newyorktimes', 'E33946'],
    ['Notion.svg', 'notion', '37352F'],
    ['NPM.svg', 'npm', 'CB3837'],
    ['Patreon.svg', 'patreon', 'FF424D'],
    ['Pinterest.svg', 'pinterest', 'BD081C'],
    ['Pocket.svg', null, null],
    ['Reddit.svg', 'reddit', 'FF4500'],
    ['Slack.svg', null, null],
    ['SoundCloud.svg', 'soundcloud', 'FF5500'],
    ['Spotify.svg', 'spotify', '1DB954'],
    ['Stack Overflow.svg', 'stackoverflow', 'F58025'],
    ['Strava.svg', 'strava', 'FC4C02'],
    ['Substack.svg', 'substack', 'FF6719'],
    ['Tasty.svg', null, null],
    ['Trello.svg', 'trello', '0052CC'],
    ['Twitch.svg', 'twitch', '9146FF'],
    ['Twitter.svg', 'x', '1D9BF0'],
    ['Untappd.svg', 'untappd', 'FFC000'],
    ['Wikipedia.svg', 'wikipedia', '0645AD'],
    ['Yelp.svg', 'yelp', 'FF1A1A'],
    ['YouTube.svg', 'youtube', 'FF0000'],
    ['Zillow.svg', 'zillow', '006AFF'],
];

const SI_CDN = 'https://cdn.simpleicons.org';
const SI_RAW = 'https://raw.githubusercontent.com/simple-icons/simple-icons/9.0.0/icons';

async function fetchText(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.text();
}

function injectSvgFill(svg, hex) {
    if (/<svg[^>]*\bfill=/.test(svg)) return svg;
    return svg.replace('<svg ', `<svg fill="#${hex}" `);
}

fs.mkdirSync(outDir, { recursive: true });

for (const [name, slug, hex] of rows) {
    const dest = path.join(outDir, name);
    if (slug === null && name === 'AllRecipes.svg') {
        const src = path.join(root, 'favicons', 'AllRecipes.svg');
        const alt = path.join(root, 'favicons', 'colorful', 'AllRecipes.svg');
        fs.copyFileSync(fs.existsSync(src) ? src : alt, dest);
        console.log('copy', name);
        continue;
    }
    if (slug === null && name === 'Pocket.svg') {
        const svg = await fetchText(`${SI_RAW}/pocket.svg`);
        fs.writeFileSync(dest, injectSvgFill(svg, 'EF4056'));
        console.log('raw+fill', name);
        continue;
    }
    if (slug === null && name === 'Slack.svg') {
        const svg = await fetchText(`${SI_RAW}/slack.svg`);
        fs.writeFileSync(dest, injectSvgFill(svg, '4A154B'));
        console.log('raw+fill', name);
        continue;
    }
    if (slug === null && name === 'Tasty.svg') {
        const src = path.join(root, 'favicons', 'Tasty.svg');
        const alt = path.join(root, 'favicons', 'colorful', 'Tasty.svg');
        fs.copyFileSync(fs.existsSync(src) ? src : alt, dest);
        console.log('copy', name);
        continue;
    }
    const url = hex ? `${SI_CDN}/${slug}/${hex}` : `${SI_CDN}/${slug}`;
    try {
        const svg = await fetchText(url);
        fs.writeFileSync(dest, svg);
        console.log('cdn', name);
    } catch (e) {
        const primary = path.join(root, 'favicons', name);
        const colorful = path.join(root, 'favicons', 'colorful', name);
        const src = fs.existsSync(primary) ? primary : fs.existsSync(colorful) ? colorful : null;
        if (src) {
            fs.copyFileSync(src, dest);
            console.warn('fallback copy', name, String(e.message));
        } else {
            console.error('FAIL', name, e);
            process.exitCode = 1;
        }
    }
}

console.log('done ->', outDir);
