(function () {
    window.productSections = window.productSections || {};

    window.productSections.history = function () {
        return {
            heading: 'From your history',
            cards: [
                {
                    image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=600&q=80',
                    alt: 'Quantum computing article',
                    title: 'Quantum computing breakthroughs and next steps ahead',
                    meta: 'Wikipedia',
                    metaFavicon: 'favicons/Wikipedia.svg'
                },
                {
                    image: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=600&q=80',
                    alt: 'Keynote video',
                    title: 'Keynote livestream highlights recap and timestamps',
                    meta: 'YouTube',
                    metaFavicon: 'favicons/YouTube.svg'
                },
                {
                    image: 'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=600&q=80',
                    alt: 'Quarterly insights document',
                    title: 'Quarterly insights outline saved for leadership review',
                    meta: 'Google Docs',
                    metaFavicon: 'favicons/Google Docs.svg'
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

