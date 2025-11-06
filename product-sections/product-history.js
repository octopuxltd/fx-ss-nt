(function () {
    window.productSections = window.productSections || {};

    window.productSections.history = function () {
        return {
            heading: 'From your history',
            cards: [
                {
                    image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=600&q=80',
                    alt: 'Recently visited article',
                    title: 'Recently visited article',
                    meta: 'Saved from last week'
                },
                {
                    image: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=600&q=80',
                    alt: 'Recent video highlight',
                    title: 'Video highlight recap',
                    meta: 'Watched yesterday'
                },
                {
                    image: 'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=600&q=80',
                    alt: 'Research document',
                    title: 'Research document draft',
                    meta: 'Opened 2 days ago'
                }
            ]
        };
    };
})();

