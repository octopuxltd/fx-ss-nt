(function () {
    window.productSections = window.productSections || {};

    window.productSections.openTabs = function () {
        return {
            heading: 'Recently active tabs',
            cards: [
                {
                    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80',
                    alt: 'Workspace dashboard',
                    title: 'Workspace dashboard',
                    meta: 'Notion',
                    metaFavicon: 'favicons/Google.svg',
                    lastViewed: 'Last active 3 hours ago'
                },
                {
                    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80',
                    alt: 'Code review',
                    title: 'Code review tab',
                    meta: 'GitHub',
                    metaFavicon: 'favicons/Google.svg',
                    lastViewed: 'Last active 30 minutes ago'
                },
                {
                    image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80',
                    alt: 'Focus playlist',
                    title: 'Focus playlist',
                    meta: 'Spotify',
                    metaFavicon: 'favicons/Google.svg',
                    lastViewed: 'Last active 1 hour ago'
                }
            ]
        };
    };

    window.productSections.openTabsPhase1 = function () {
        return {
            heading: 'From your open tabs',
            cards: [
                { title: 'Workspace dashboard', meta: 'Currently open in another window' },
                { title: 'Code review tab', meta: 'Review pending' },
                { title: 'Focus playlist', meta: 'Playing now' },
                { title: 'Team sprint board', meta: 'Last activity 4 minutes ago' }
            ]
        };
    };
})();

