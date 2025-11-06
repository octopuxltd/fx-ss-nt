(function () {
    window.productSections = window.productSections || {};

    window.productSections.bookmarks = function () {
        return {
            heading: 'From your bookmarks',
            cards: [
                {
                    image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80',
                    alt: 'Design inspiration set',
                    title: 'Design inspiration set',
                    meta: 'Pinned to bookmarks'
                },
                {
                    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80',
                    alt: 'Travel itinerary',
                    title: 'Weekend travel itinerary',
                    meta: 'Shared with friends'
                },
                {
                    image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=600&q=80',
                    alt: 'Recipe collection',
                    title: 'Recipe collection',
                    meta: 'Favorite meals list'
                }
            ]
        };
    };
})();

