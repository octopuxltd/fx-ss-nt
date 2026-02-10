(function () {
    window.productSections = window.productSections || {};

    window.productSections.history = function () {
        return {
            heading: 'From your history',
            cards: [
                {
                    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
                    alt: 'Recipe article',
                    title: 'Easy weeknight dinners',
                    meta: 'Tasty',
                    metaFavicon: 'favicons/Tasty.svg',
                    lastViewed: '2 days ago'
                },
                {
                    image: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=600&q=80',
                    alt: 'TV show video',
                    title: 'The Crown season 6',
                    meta: 'YouTube',
                    metaFavicon: 'favicons/YouTube.svg',
                    lastViewed: 'Continue viewing (16m left)'
                },
                {
                    image: 'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=600&q=80',
                    alt: 'Quarterly insights document',
                    title: 'Q4 Report 2025',
                    meta: 'Google Docs',
                    metaFavicon: 'favicons/Google Docs.svg',
                    lastViewed: 'Opened weekdays at this time'
                },
                {
                    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
                    alt: 'Burger recipe',
                    title: 'Best burger recipe',
                    meta: 'AllRecipes',
                    metaFavicon: 'favicons/AllRecipes.svg',
                    lastViewed: 'Opened around dinner time'
                },
                {
                    image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=600&q=80',
                    alt: 'Hiking trail',
                    title: 'Local hiking trails',
                    meta: 'AllTrails',
                    metaFavicon: 'favicons/AllTrails.svg',
                    lastViewed: 'Last viewed 4 days ago'
                },
                {
                    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=600&q=80',
                    alt: 'Fashion trends',
                    title: 'Summer outfit ideas',
                    meta: 'Pinterest',
                    metaFavicon: 'favicons/Pinterest.svg',
                    lastViewed: 'Last viewed 1 week ago'
                }
            ]
        };
    };

    window.productSections.historyPhase1 = function () {
        return {
            heading: 'From your history',
            cards: [
                { title: 'Quantum computing breakthroughs and next steps ahead', favicon: 'favicons/Wikipedia.svg', showActions: true },
                { title: 'Keynote livestream highlights recap and timestamps', favicon: 'favicons/YouTube.svg', showActions: true },
                { title: 'Quarterly insights outline saved for leadership review', favicon: 'favicons/Google Docs.svg', showActions: true },
                { title: 'artisan coffee guide nearby with bookmarked roasters', favicon: 'favicons/Google.svg', showActions: true },
                { title: 'Design toolkit refresh notes for tomorrow’s workshop', favicon: 'favicons/Figma.svg', showActions: true },
                { title: 'Stand-up collaboration notes and follow-up checklist', favicon: 'favicons/Microsoft Teams.svg', showActions: true },
                { title: 'browser experiments and release roadmap preview', favicon: 'favicons/Mozilla.svg', showActions: true }
            ]
        };
    };
})();

