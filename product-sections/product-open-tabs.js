(function () {
    window.productSections = window.productSections || {};

    window.productSections.openTabs = function () {
        return {
            heading: 'Recently active tabs',
            cards: [
                {
                    image: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=600&q=80',
                    alt: 'Vacation photos',
                    title: 'Summer vacation album',
                    meta: 'Instagram',
                    metaFavicon: 'favicons/Instagram.svg',
                    lastViewed: 'Last active 20 minutes ago'
                },
                {
                    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
                    alt: 'Home improvement',
                    title: 'DIY bathroom makeover',
                    meta: 'Pinterest',
                    metaFavicon: 'favicons/Pinterest.svg',
                    lastViewed: 'Last active 30 minutes ago'
                },
                {
                    image: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?auto=format&fit=crop&w=600&q=80',
                    alt: 'Focus playlist',
                    title: 'Focus playlist',
                    meta: 'Spotify',
                    metaFavicon: 'favicons/Spotify.svg',
                    lastViewed: 'Last active 1 hour ago'
                },
                {
                    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80',
                    alt: 'Shopping cart',
                    title: 'Shopping cart',
                    meta: 'Amazon',
                    metaFavicon: 'favicons/Amazon - Light.svg',
                    lastViewed: 'Last active 2 hours ago'
                },
                {
                    image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80',
                    alt: 'Travel planning',
                    title: 'Weekend getaway ideas',
                    meta: 'TripAdvisor',
                    metaFavicon: 'favicons/TripAdvisor.svg',
                    lastViewed: 'Last active 3 hours ago'
                },
                {
                    image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80',
                    alt: 'Movie reviews',
                    title: 'Movies to watch',
                    meta: 'IMDb',
                    metaFavicon: 'favicons/IMDb.svg',
                    lastViewed: 'Last active 4 hours ago'
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

