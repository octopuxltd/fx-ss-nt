const productContent = (() => {
    const columns = [
        {
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
        },
        {
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
        },
        {
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
        }
    ];

    const renderCard = (card) => `
        <a href="#" class="overlay-product-card">
            <img src="${card.image}" alt="${card.alt}">
            <div class="overlay-product-card-body">
                <h3 class="overlay-product-title">${card.title}</h3>
                <p class="overlay-product-meta">${card.meta}</p>
            </div>
        </a>
    `;

    const renderColumn = (column) => `
        <div class="overlay-product-column">
            <p class="overlay-product-heading">${column.heading}</p>
            ${column.cards.map(renderCard).join('')}
        </div>
    `;

    const renderGrid = () => columns.map(renderColumn).join('');

    return {
        renderGrid,
    };
})();

