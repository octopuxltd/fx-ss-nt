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

    const renderCard = (card, columnKey) => {
        const favicon = card.favicon ? `<img src="${card.favicon}" alt="" class="overlay-product-favicon" role="presentation">` : '';
        const image = card.image ? `<img src="${card.image}" alt="${card.alt || ''}">` : '';
        const metaFavicon = card.metaFavicon ? `<img src="${card.metaFavicon}" alt="" class="overlay-product-meta-favicon" role="presentation">` : '';
        const meta = card.meta ? `<p class="overlay-product-meta">${metaFavicon}${card.meta}</p>` : '';
        const actions = card.showActions ? `
            <span class="overlay-product-card-actions" aria-hidden="true">
                <svg width="16" height="6" viewBox="0 0 16 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="3" cy="3" r="1" fill="currentColor"/>
                    <circle cx="8" cy="3" r="1" fill="currentColor"/>
                    <circle cx="13" cy="3" r="1" fill="currentColor"/>
                </svg>
            </span>
        ` : '';

        // Article-style cards: image on top, text below
        if (columnKey === 'articles') {
            return `
            <a href="#" class="overlay-product-card overlay-product-card--article">
                ${image}
                <div class="overlay-product-card-body">
                    <h3 class="overlay-product-title">${card.title}</h3>
                    ${meta}
                </div>
            </a>
        `;
        }

        // Regular cards: favicon/image on left, text on right
        return `
        <a href="#" class="overlay-product-card">
            ${favicon}
            ${image}
            <div class="overlay-product-card-body">
                <h3 class="overlay-product-title">${card.title}</h3>
                ${meta}
            </div>
            ${actions}
        </a>
    `;
    };

    const renderColumn = (column) => {
        const cardsHtml = column.cards.map(card => renderCard(card, column.key)).join('');
        const listWrapper = (column.key === 'historyPhase1' || column.key === 'bookmarksPhase1')
            ? `<div class="overlay-product-card-list">${cardsHtml}</div>`
            : cardsHtml;

        return `
        <div class="overlay-product-column">
            <p class="overlay-product-heading">${column.heading}</p>
            ${listWrapper}
        </div>
    `;
    };

    const getSections = (sectionKeys) => {
        const keysToUse = Array.isArray(sectionKeys) && sectionKeys.length
            ? sectionKeys
            : DEFAULT_SECTIONS;

        return keysToUse
            .map((key) => key && key.trim())
            .filter(Boolean)
            .map((key) => {
                const section = resolveSection(key);
                return section ? { ...section, key } : null;
            })
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

