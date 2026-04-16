#!/usr/bin/env node
/** Rewrites `favicons/<pool>.svg` -> `favicons/colorful/<pool>.svg` in HTML/JS (not node_modules). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const names = [
    'Airbnb.svg',
    'AllRecipes.svg',
    'AllTrails.svg',
    'Bluesky.svg',
    'CBC.svg',
    'Chess.com.svg',
    'Discord.svg',
    'Duolingo.svg',
    'Etsy.svg',
    'Figma.svg',
    'GitHub.svg',
    'Goodreads.svg',
    'IMDb.svg',
    'Instagram.svg',
    'Internet Archive.svg',
    'Itch.io.svg',
    'Khan Academy.svg',
    'Kickstarter.svg',
    'Letterboxd.svg',
    'Lichess.svg',
    'Linear.svg',
    'Mastodon.svg',
    'MyAnimeList.svg',
    'NewYorkTimes.svg',
    'Notion.svg',
    'NPM.svg',
    'Patreon.svg',
    'Pinterest.svg',
    'Pocket.svg',
    'Reddit.svg',
    'Slack.svg',
    'SoundCloud.svg',
    'Spotify.svg',
    'Stack Overflow.svg',
    'Strava.svg',
    'Substack.svg',
    'Tasty.svg',
    'Trello.svg',
    'Twitch.svg',
    'Twitter.svg',
    'Untappd.svg',
    'Wikipedia.svg',
    'Yelp.svg',
    'YouTube.svg',
    'Zillow.svg',
];

function walk(dir, out = []) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.name === 'node_modules' || ent.name === '.git') continue;
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p, out);
        else if (/\.(html|js|mjs)$/.test(ent.name)) out.push(p);
    }
    return out;
}

let patched = 0;
for (const file of walk(root)) {
    let s = fs.readFileSync(file, 'utf8');
    const orig = s;
    for (const n of names) {
        const from = `favicons/${n}`;
        const to = `favicons/colorful/${n}`;
        s = s.split(from).join(to);
    }
    if (s !== orig) {
        fs.writeFileSync(file, s);
        patched++;
        console.log('patched', path.relative(root, file));
    }
}
console.log('files patched:', patched);
