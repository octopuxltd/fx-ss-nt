(function () {
    window.productSections = window.productSections || {};

    window.productSections.bookmarks = function () {
        return {
            heading: 'Bookmarks to revisit',
            cards: [
                {
                    image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80',
                    alt: 'Design inspiration',
                    title: 'Inspiration album',
                    meta: 'Instagram',
                    metaFavicon: 'favicons/Instagram.svg',
                    lastViewed: 'Saved 2 weeks ago'
                },
                {
                    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80',
                    alt: 'Travel itinerary',
                    title: 'Vacation planning',
                    meta: 'Google',
                    metaFavicon: 'favicons/Google.svg',
                    lastViewed: 'Saved 1 month ago'
                },
                {
                    image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=600&q=80',
                    alt: 'Recipe collection',
                    title: 'Quick Recipes',
                    meta: 'YouTube',
                    metaFavicon: 'favicons/YouTube.svg',
                    lastViewed: 'Saved 3 days ago'
                },
                {
                    image: 'https://images.unsplash.com/photo-1452457807411-4979b707c5be?auto=format&fit=crop&w=600&q=80',
                    alt: 'Gardening tips',
                    title: 'Spring gardening guide',
                    meta: 'Reddit',
                    metaFavicon: 'favicons/Reddit.svg',
                    lastViewed: 'Saved 5 days ago'
                },
                {
                    image: 'https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?auto=format&fit=crop&w=600&q=80',
                    alt: 'Fitness routine',
                    title: 'Home workout plan',
                    meta: 'YouTube',
                    metaFavicon: 'favicons/YouTube.svg',
                    lastViewed: 'Saved 1 week ago'
                },
                {
                    image: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=600&q=80',
                    alt: 'Weekend activities',
                    title: 'Things to do nearby',
                    meta: 'Yelp',
                    metaFavicon: 'favicons/Yelp.svg',
                    lastViewed: 'Saved 4 days ago'
                }
            ]
        };
    };

    window.productSections.bookmarksPhase1 = function () {
        return {
            heading: 'From your bookmarks',
            cards: [
                { title: 'Design inspiration set with curated color palettes and typography examples', favicon: 'favicons/Instagram.svg', showActions: true },
                { title: 'Weekend travel itinerary with restaurant recommendations and local attractions', favicon: 'favicons/Google.svg', showActions: true },
                { title: 'Recipe collection featuring favorite meals and cooking techniques from around the world', favicon: 'favicons/YouTube.svg', showActions: true },
                { title: 'UI patterns board showcasing modern interface designs and interaction patterns', favicon: 'favicons/Figma.svg', showActions: true },
                { title: 'JavaScript best practices guide covering ES6 features and performance optimization', favicon: 'favicons/Mozilla.svg', showActions: true },
                { title: 'Productivity tools comparison with detailed feature breakdowns and pricing information', favicon: 'favicons/Google Docs.svg', showActions: true },
                { title: 'Color palette references organized by mood and industry with hex codes and usage examples', favicon: 'favicons/Reddit.svg', showActions: true }
            ]
        };
    };
})();

