const productContent = (() => {
    const registry = window.productSections || {};
    const DEFAULT_SECTIONS = ['history', 'bookmarks', 'openTabs'];

    const resolveSection = (key) => {
        const entry = registry[key];
        if (!entry) {
            return null;
        }

        const section = typeof entry === 'function' ? entry() : entry;
        if (!section || !section.heading || !Array.isArray(section.cards)) {
            return null;
        }

        return section;
    };

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

    const getSections = (sectionKeys) => {
        const keysToUse = Array.isArray(sectionKeys) && sectionKeys.length
            ? sectionKeys
            : DEFAULT_SECTIONS;

        return keysToUse
            .map((key) => key && key.trim())
            .filter(Boolean)
            .map((key) => resolveSection(key))
            .filter(Boolean);
    };

    const renderGrid = (sectionKeys) => getSections(sectionKeys)
        .map(renderColumn)
        .join('');

    const renderInto = (container, sectionKeys) => {
        if (!container) {
            return;
        }

        container.innerHTML = renderGrid(sectionKeys);
    };

    return {
        DEFAULT_SECTIONS,
        renderGrid,
        renderInto,
    };
})();

