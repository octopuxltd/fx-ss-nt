const productContent = (() => {
    const DEFAULT_SECTIONS = ['history', 'bookmarks', 'openTabs'];

    const resolveSection = (key) => {
        const registry = window.productSections || {};
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
        const metaFavicon = card.metaFavicon ? `<img src="${card.metaFavicon}" alt="" class="overlay-product-meta-favicon overlay-product-image-favicon" role="presentation">` : '';
        
        // Add section icon based on columnKey
        let sectionIcon = '';
        if (columnKey === 'history') {
            sectionIcon = '<svg class="overlay-product-section-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1"/><path d="M6 2.5V6L8.5 7" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        } else if (columnKey === 'openTabs') {
            sectionIcon = '<svg class="overlay-product-section-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="10" height="8" rx="1" stroke="currentColor" stroke-width="1"/><path d="M1 4H11" stroke="currentColor" stroke-width="1"/><circle cx="3" cy="3" r="0.5" fill="currentColor"/><circle cx="5" cy="3" r="0.5" fill="currentColor"/></svg>';
        } else if (columnKey === 'bookmarks') {
            sectionIcon = '<svg class="overlay-product-section-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 1.2C6.3 2.2 6.6 3.2 7.3 4.4C8.2 4.6 9.4 4.7 10.6 4.9C9.8 6.1 9 7.1 8.3 7.4C8.8 8.8 9.1 9.8 9.2 10.6C7.8 9.8 6.9 9.2 6 8.8C4.1 9.2 3.2 9.8 2.8 10.6C3.1 8.8 3.4 7.8 3.7 7.4C2.8 6.5 2.1 5.5 1.4 4.9C3 5.1 4.1 4.8 4.7 4.4C5.4 3.2 5.7 2.2 6 1.2Z" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
        }
        
        const metaText = card.meta ? `<span class="overlay-product-meta-text">${card.meta}</span>` : '';
        // Only add "Last viewed" prefix for quantum computing (first card), others show custom text directly
        const lastViewedPrefix = card.title === 'Quantum computing' && card.lastViewed ? 'Last viewed ' : '';
        const lastViewedText = card.lastViewed && (columnKey === 'history' || columnKey === 'openTabs' || columnKey === 'bookmarks') ? `<span class="overlay-product-last-viewed">${lastViewedPrefix}${card.lastViewed}</span>` : '';
        const meta = card.meta ? `<p class="overlay-product-meta">${sectionIcon}<span class="overlay-product-meta-left">${metaText}${lastViewedText}</span></p>` : '';
        
        // Wrap image with favicon overlay if image exists
        const imageWithFavicon = image && metaFavicon ? `<div class="overlay-product-image-wrapper">${image}${metaFavicon}</div>` : image;
        const actions = card.showActions ? `
            <span class="overlay-product-card-actions" aria-hidden="true">
                <svg width="16" height="6" viewBox="0 0 16 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="3" cy="3" r="1" fill="currentColor"/>
                    <circle cx="8" cy="3" r="1" fill="currentColor"/>
                    <circle cx="13" cy="3" r="1" fill="currentColor"/>
                </svg>
            </span>
        ` : '';

        // Article-style cards: image on top, text below (matching renewable energy card layout)
        if (columnKey === 'articles') {
            const imageHtml = image || '<div class="image-placeholder"></div>';
            return `
            <a href="#" class="overlay-product-card overlay-product-card--article">
                ${imageHtml}
                <h2>${card.title}</h2>
                <p class="sponsored-label">Sponsored · Amazon.com</p>
            </a>
        `;
        }

        // Regular cards: favicon/image on left, text on right
        return `
        <a href="#" class="overlay-product-card">
            ${favicon}
            ${imageWithFavicon || image}
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

        // Don't show heading for articles section
        const headingHtml = column.key === 'articles' ? '' : `<p class="overlay-product-heading">${column.heading}</p>`;

        return `
        <div class="overlay-product-column">
            ${headingHtml}
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

