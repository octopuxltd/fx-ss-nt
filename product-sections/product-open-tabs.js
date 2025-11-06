(function () {
    window.productSections = window.productSections || {};

    window.productSections.openTabs = function () {
        return {
            heading: 'From your open tabs',
            cards: [
                {
                    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80',
                    alt: 'Workspace dashboard',
                    title: 'Workspace dashboard',
                    meta: 'Currently open in another window'
                },
                {
                    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80',
                    alt: 'Code review tab',
                    title: 'Code review tab',
                    meta: 'Review pending'
                },
                {
                    image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80',
                    alt: 'Music playlist tab',
                    title: 'Focus playlist',
                    meta: 'Playing now'
                }
            ]
        };
    };
})();

