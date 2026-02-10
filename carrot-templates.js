// ============================================================================
// CARROT TEMPLATES
// ============================================================================
//
// This file contains all HTML templates for search carrots (rich preview cards).
// Each template is a function that returns an HTML string.
//
// CARROT TYPES:
// -------------
// - Local recommendations: Coffee shops, restaurants, local businesses
// - Flights: Flight schedules and status
// - Wikipedia: Encyclopedia article previews
// - Weather: 7-day weather forecasts
// - Sports: Live scores, standings, schedules
// - Stocks: Stock prices, financial data
// - World Clock: Time zones with analog clock display
//
// TEMPLATE STRUCTURE:
// -------------------
// Templates use template literals with:
//   - Static demo data (for prototype)
//   - Semantic HTML structure
//   - BEM-style CSS classes
//   - Inline color classes where needed (green-text, red-text)
//   - Accessibility attributes (aria-hidden, alt text)
//
// FUTURE IMPROVEMENTS:
// --------------------
// - Accept data parameters for dynamic content
// - Add error/loading state templates
// - Extract common components (pin buttons, tiles)
//
// ============================================================================

const carrotTemplates = {
    /**
     * Local recommendations carrot (coffee shops, restaurants)
     * Shows business listings with images, ratings, and hours
     */
    local: () => `
        <li class="search-suggestions-preview-item carrot carrot--local local-business-wrapper" data-index="coffee-1">
            <div class="local-business" data-business-index="0">
                <img src="https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=200&h=200&q=80" alt="Peet's Coffee" class="local-business-image">
                <div class="local-business-content">
                    <p class="local-business-name">Peet's Coffee</p>
                    <p class="local-business-details">1574 Alfredo St, New York · $$ · <span class="local-business-status local-business-status--open"><strong>Open</strong> until 7pm</span> · <span class="local-business-rating"><span class="star">★</span> 4.3 (1.1k)</span></p>
                    <p class="local-business-sponsored">Sponsored · Your location: New York (<span class="local-business-location-change">change</span>)</p>
                </div>
            </div>
            <div class="local-business" data-business-index="1">
                <img src="https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=200&h=200&q=80" alt="Blue Bottle Coffee" class="local-business-image">
                <div class="local-business-content">
                    <p class="local-business-name">Blue Bottle Coffee</p>
                    <p class="local-business-details">450 Hayes St, New York · $$$ · <span class="local-business-status local-business-status--open"><strong>Open</strong> until 8pm</span> · <span class="local-business-rating"><span class="star">★</span> 4.6 (2.3k)</span></p>
                    <p class="local-business-sponsored">Sponsored · Your location: New York (<span class="local-business-location-change">change</span>)</p>
                </div>
            </div>
        </li>
    `,

    /**
     * Ad marketplace carrot
     * Shows sponsored/ad listings with images, ratings, and details
     * Uses same structure as local recommendations for horizontal display
     */
    adMarketplace: () => `
        <li class="search-suggestions-preview-item carrot carrot--local carrot--ad-marketplace">
            <div class="local-business local-business--ad-marketplace">
                <img src="https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?auto=format&fit=crop&w=28&h=28&q=80" alt="Chairs" class="local-business-image" style="width: 28px; height: 28px;">
                <div class="local-business-content">
                    <p class="local-business-name"><strong>chair</strong> – Bed Bath & Beyond – Official Site</p>
                    <span class="ad-marketplace-sponsored">Sponsored</span>
                </div>
            </div>
            <div class="suggestion-actions">
                <button class="suggestion-menu-button" type="button" aria-label="More options">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="4" cy="8" r="1.5" fill="currentColor"/>
                        <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                        <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
                    </svg>
                </button>
            </div>
        </li>
    `,

    adMarketplaceRamen: () => `
        <li class="search-suggestions-preview-item carrot carrot--local carrot--ad-marketplace">
            <div class="local-business local-business--ad-marketplace">
                <img src="https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=28&h=28&q=80" alt="Ramen" class="local-business-image" style="width: 28px; height: 28px;">
                <div class="local-business-content">
                    <p class="local-business-name"><strong>ramen</strong> – Ichiran Ramen – Official Site</p>
                    <span class="ad-marketplace-sponsored">Sponsored</span>
                </div>
            </div>
            <div class="suggestion-actions">
                <button class="suggestion-menu-button" type="button" aria-label="More options">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="4" cy="8" r="1.5" fill="currentColor"/>
                        <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                        <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
                    </svg>
                </button>
            </div>
        </li>
    `,

    adMarketplaceSushi: () => `
        <li class="search-suggestions-preview-item carrot carrot--local carrot--ad-marketplace">
            <div class="local-business local-business--ad-marketplace">
                <img src="https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=28&h=28&q=80" alt="Sushi" class="local-business-image" style="width: 28px; height: 28px;">
                <div class="local-business-content">
                    <p class="local-business-name"><strong>sushi</strong> – Nobu Restaurant – Official Site</p>
                    <span class="ad-marketplace-sponsored">Sponsored</span>
                </div>
            </div>
            <div class="suggestion-actions">
                <button class="suggestion-menu-button" type="button" aria-label="More options">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="4" cy="8" r="1.5" fill="currentColor"/>
                        <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                        <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
                    </svg>
                </button>
            </div>
        </li>
    `,

    /**
     * Big ad carrot
     * Shows a large article-style card with sneakers content
     */
    bigAd: () => `
        <li class="search-suggestions-preview-item carrot carrot--big-ad">
            <a href="#" class="carrot-big-ad-card">
                <img src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&h=300&q=80" alt="Sneakers" class="carrot-big-ad-image">
                <div class="carrot-big-ad-body">
                    <h3 class="carrot-big-ad-title">Premium Sneakers Collection - Up to 50% Off</h3>
                    <p class="carrot-big-ad-meta">
                        <span class="carrot-big-ad-favicon" style="width: 16px; height: 16px; background-color: #000; border-radius: 2px; flex-shrink: 0;"></span>
                        Nike - Official Store
                    </p>
                </div>
                <span class="carrot-big-ad-sponsored">Sponsored</span>
            </a>
        </li>
    `,

    /**
     * Flight itinerary carrot
     * Shows departure/arrival times, dates, and flight status
     */
    flights: () => `
        <li class="search-suggestions-preview-item carrot">
            <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to homepage</button>
            <div class="carrot-tile carrot-tile--flights" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="airplane-icon">
                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="currentColor"/>
                </svg>
            </div>
            <div class="carrot-lines">
                <p class="carrot-line"><span class="carrot-line-label">Dep</span> <strong>9:21pm</strong> Chicago (CHI)</p>
                <p class="carrot-line"><span class="carrot-line-label">Arr</span> <strong>11:42am</strong> Vancouver (VYR)</p>
                <p class="carrot-line carrot-line--meta"><span class="carrot-line green-text">In flight</span> · Today · AC 8170</p>
            </div>
        </li>
        <li class="search-suggestions-preview-item carrot">
            <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to homepage</button>
            <div class="carrot-tile carrot-tile--flights" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="airplane-icon">
                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="currentColor"/>
                </svg>
            </div>
            <div class="carrot-lines">
                <p class="carrot-line"><span class="carrot-line-label">Dep</span> <strong>9:21pm</strong> Chicago (CHI)</p>
                <p class="carrot-line"><span class="carrot-line-label">Arr</span> <strong>11:42am</strong> Vancouver (VYR)</p>
                <p class="carrot-line carrot-line--meta">Tomorrow · AC 8170</p>
            </div>
        </li>
        <li class="search-suggestions-preview-item carrot">
            <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to homepage</button>
            <div class="carrot-tile carrot-tile--flights" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="airplane-icon">
                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="currentColor"/>
                </svg>
            </div>
            <div class="carrot-lines">
                <p class="carrot-line"><span class="carrot-line-label">Dep</span> <strong>9:21pm</strong> Chicago (CHI)</p>
                <p class="carrot-line"><span class="carrot-line-label">Arr</span> <strong>11:42am</strong> Vancouver (VYR)</p>
                 <p class="carrot-line carrot-line--meta">Fri, June 6 · AC 8170</p>
            </div>
        </li>
    `,

    /**
     * Wikipedia article carrot
     * Shows article summary with portrait image
     */
    wikipedia: () => `
        <li class="search-suggestions-preview-item carrot carrot--wikipedia">
            <div class="carrot-wikipedia-header">
                <img src="favicons/Wikipedia.svg" alt="" class="carrot-wikipedia-icon" aria-hidden="true">
                <p class="carrot-wikipedia-heading">From Wikipedia</p>
            </div>
            <div class="carrot-wikipedia-content-wrapper">
                <div class="carrot-text-content">
                    <p class="carrot-line carrot-line--title">Fox</p>
                    <p class="carrot-line">Foxes are small-to-medium-sized omnivorous mammals belonging to several genera of the family Canidae. They have a flattened skull, upright triangular ears, a pointed, slightly upturned snout, and a long bushy tail. Twelve species belong to the monophyletic "true fox" group of genus Vulpes.</p>
                    <a href="https://en.wikipedia.org/wiki/Fox" class="carrot-link" target="_blank" rel="noopener noreferrer">https://en.wikipedia.org/wiki/Fox</a>
                </div>
                <div class="carrot-image-container">
                    <img src="https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=300&h=400&q=80" alt="Red Fox" class="carrot-portrait-image">
                    <p class="carrot-image-caption">Red Fox (Vulpes vulpes)</p>
                </div>
            </div>
        </li>
    `,

    /**
     * Placeholder carrot (state 3)
     * Reserved for future use - currently shows mixed content samples
     */
    placeholder: () => `
        <li class="search-suggestions-preview-item carrot">
            <div class="carrot-tile" aria-hidden="true"></div>
            <div class="carrot-lines">
                <p class="carrot-line">Upcoming event · Friday night</p>
                <p class="carrot-line">Local league finals</p>
                <p class="carrot-line carrot-line--meta">Tickets available · Section 112</p>
            </div>
        </li>
        <li class="search-suggestions-preview-item carrot">
            <div class="carrot-tile" aria-hidden="true"></div>
            <div class="carrot-lines">
                <p class="carrot-line">Live stats · Markets open</p>
                <p class="carrot-line">Tech Growth ETF · +1.8%</p>
                <p class="carrot-line carrot-line--meta">Updated just now</p>
            </div>
        </li>
        <li class="search-suggestions-preview-item carrot">
            <div class="carrot-tile" aria-hidden="true"></div>
            <div class="carrot-lines">
                <p class="carrot-line">World clock</p>
                <p class="carrot-line">Tokyo · <strong>05:17</strong></p>
                <p class="carrot-line carrot-line--meta">+9 GMT · Sunrise in 43 min</p>
            </div>
        </li>
    `,

    /**
     * Weather forecast carrot
     * Shows 7-day forecast with temperatures and weather icons
     */
    weather: () => `
        <li class="search-suggestions-preview-item carrot carrot--weather">
            <div class="weather-header">
                <div class="weather-title-section">
                    <p class="weather-title">Weather</p>
                    <p class="weather-subtitle">Accuweather • Your location: New York (<span class="weather-location-change" style="text-decoration: underline; cursor: pointer;">change</span>)</p>
                </div>
                <button class="weather-pin-button" type="button"><span class="pin-icon">📌</span>Pin to homepage</button>
            </div>
            <div class="weather-days">
                <div class="weather-day">
                    <p class="weather-day-name">Mon</p>
                    <div class="weather-icon">☀️</div>
                    <p class="weather-temp">72°</p>
                    <p class="weather-temp-low">58°</p>
                </div>
                <div class="weather-day">
                    <p class="weather-day-name">Tue</p>
                    <div class="weather-icon">⛅</div>
                    <p class="weather-temp">68°</p>
                    <p class="weather-temp-low">55°</p>
                </div>
                <div class="weather-day">
                    <p class="weather-day-name">Wed</p>
                    <div class="weather-icon">🌧️</div>
                    <p class="weather-temp">62°</p>
                    <p class="weather-temp-low">52°</p>
                </div>
                <div class="weather-day">
                    <p class="weather-day-name">Thu</p>
                    <div class="weather-icon">⛈️</div>
                    <p class="weather-temp">59°</p>
                    <p class="weather-temp-low">50°</p>
                </div>
                <div class="weather-day">
                    <p class="weather-day-name">Fri</p>
                    <div class="weather-icon">🌤️</div>
                    <p class="weather-temp">65°</p>
                    <p class="weather-temp-low">53°</p>
                </div>
                <div class="weather-day">
                    <p class="weather-day-name">Sat</p>
                    <div class="weather-icon">☀️</div>
                    <p class="weather-temp">70°</p>
                    <p class="weather-temp-low">56°</p>
                </div>
                <div class="weather-day">
                    <p class="weather-day-name">Sun</p>
                    <div class="weather-icon">☀️</div>
                    <p class="weather-temp">74°</p>
                    <p class="weather-temp-low">60°</p>
                </div>
            </div>
        </li>
    `,

    /**
     * Sports carrot
     * Shows live scores, upcoming games, and standings
     * Displayed horizontally as second suggestion item
     */
    sports: () => `
        <li class="search-suggestions-preview-item carrot carrot--sports sports-wrapper" data-index="sports-1">
            <div class="sports-item" data-sports-index="0">
                <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin</button>
                <div class="carrot-tile carrot-tile--sports" aria-hidden="true">
                    <img src="icons/orlando.png" alt="" class="sports-icon" aria-hidden="true">
                </div>
                <div class="carrot-lines">
                    <p class="carrot-line"><strong>LA Lakers</strong> at <strong>Orlando Panthers</strong></p>
                    <p class="carrot-line carrot-line--meta">NHL · Tomorrow at 6pm</p>
                </div>
            </div>
            <div class="sports-item" data-sports-index="1">
                <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin</button>
                <div class="carrot-tile carrot-tile--sports" aria-hidden="true">
                    <img src="icons/detroit.png" alt="" class="sports-icon" aria-hidden="true">
                </div>
                <div class="carrot-lines">
                    <p class="carrot-line"><strong>Detroit Stars</strong> at <strong>LA Lakers</strong></p>
                    <p class="carrot-line carrot-line--meta">NHL · Sat, Jun 23 at 7pm</p>
                </div>
            </div>
            <div class="sports-item" data-sports-index="2">
                <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin</button>
                <div class="carrot-tile carrot-tile--sports" aria-hidden="true">
                    <img src="icons/chicago.png" alt="" class="sports-icon" aria-hidden="true">
                </div>
                <div class="carrot-lines">
                    <p class="carrot-line"><strong>LA Lakers</strong> at <strong>Chicago Bulls</strong></p>
                    <p class="carrot-line carrot-line--meta">NHL · Sat Jun 30 at 7pm</p>
                </div>
            </div>
        </li>
    `,

    /**
     * Stocks carrot
     * Shows stock price, changes, and related financial data
     * Colors: green for positive changes, red for negative changes
     * Displayed horizontally as second suggestion item
     */
    stocks: () => `
        <li class="search-suggestions-preview-item carrot carrot--stocks stocks-wrapper" data-index="stocks-1">
            <div class="stock-item" data-stock-index="0">
                <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to homepage</button>
                <div class="carrot-tile carrot-tile--stocks carrot-tile--stocks-up" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="stock-arrow-icon">
                        <path d="M12 5v14M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="carrot-lines">
                    <p class="carrot-line"><strong>UBER</strong> · Uber Technologies Inc</p>
                    <p class="carrot-line"><span class="green-text">+2.18 (3.06%)</span> · $73.45 <span class="small-caps">USD</span> · NYSE</p>
                </div>
            </div>
        </li>
    `,

    /**
     * Stocks ETFs carrot
     * Shows ETF stock information (VOO, QQQ, DIA)
     * Colors: green for positive changes, red for negative changes, grey for no change
     * Displayed horizontally as second suggestion item
     */
    stocksETFs: () => `
        <li class="search-suggestions-preview-item carrot carrot--stocks stocks-wrapper" data-index="stocks-etfs-1">
            <div class="stock-item" data-stock-index="0">
                <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin</button>
                <div class="carrot-tile carrot-tile--stocks carrot-tile--stocks-down" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="stock-arrow-icon">
                        <path d="M12 19V5M5 12l7 7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="carrot-lines">
                    <p class="carrot-line"><strong>VOO</strong> · Vanguard S&P 500 ETF</p>
                    <p class="carrot-line"><span class="red-text">-0.11%</span> · $559.44 <span class="small-caps">USD</span> · S&P 500</p>
                </div>
            </div>
            <div class="stock-item" data-stock-index="1">
                <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin</button>
                <div class="carrot-tile carrot-tile--stocks carrot-tile--stocks-up" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="stock-arrow-icon">
                        <path d="M12 5v14M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="carrot-lines">
                    <p class="carrot-line"><strong>QQQ</strong> · Invesco QQQ Trust</p>
                    <p class="carrot-line"><span class="green-text">+1.53%</span> · $539.78 <span class="small-caps">USD</span> · NASDAQ</p>
                </div>
            </div>
            <div class="stock-item" data-stock-index="2">
                <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin</button>
                <div class="carrot-tile carrot-tile--stocks carrot-tile--stocks-neutral" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="stock-arrow-icon">
                        <path d="M7 12h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="carrot-lines">
                    <p class="carrot-line"><strong>DIA</strong> · SPDR Dow Jones ETF</p>
                    <p class="carrot-line">0% · $480.40 <span class="small-caps">USD</span> · Dow Jones</p>
                </div>
            </div>
        </li>
    `,

    /**
     * World clock carrot
     * Shows current time in Rome with analog clock display
     * Dynamically calculates real-time based on user's device clock
     * 
     * @returns {string} HTML template with current Rome time
     */
    worldClock: () => {
        // Calculate current Rome time
        const now = new Date();
        const romeTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
        
        const hours = romeTime.getHours();
        const minutes = romeTime.getMinutes();
        const seconds = romeTime.getSeconds();
        
        // Format for display
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes.toString().padStart(2, '0');
        const period = hours >= 12 ? 'PM' : 'AM';
        
        // Calculate clock hand angles
        const hourAngle = ((hours % 12) * 30) + (minutes * 0.5); // 30° per hour + 0.5° per minute
        const minuteAngle = (minutes * 6) + (seconds * 0.1); // 6° per minute + 0.1° per second
        const secondAngle = seconds * 6; // 6° per second
        
        // Format date
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dayName = dayNames[romeTime.getDay()];
        const monthName = monthNames[romeTime.getMonth()];
        const date = romeTime.getDate();
        
        // Get timezone abbreviation (CET in winter, CEST in summer)
        // Rome is UTC+1 in winter (CET) and UTC+2 in summer (CEST)
        // DST in Europe typically runs from last Sunday in March to last Sunday in October
        // Get the month in Rome's timezone
        const romeMonth = parseInt(now.toLocaleString('en-US', { timeZone: 'Europe/Rome', month: 'numeric' }));
        const isDST = romeMonth >= 3 && romeMonth <= 10;
        const timezoneAbbr = isDST ? 'CEST (UTC+2)' : 'CET (UTC+1)';
        
        return `
            <li class="search-suggestions-preview-item carrot carrot--clock">
                <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to homepage</button>
                <div class="clock-container">
                    <div class="analog-clock">
                        <div class="clock-face">
                            <div class="clock-hand clock-hand--hour" style="transform: translateX(-50%) rotate(${hourAngle}deg)"></div>
                            <div class="clock-hand clock-hand--minute" style="transform: translateX(-50%) rotate(${minuteAngle}deg)"></div>
                            <div class="clock-hand clock-hand--second" style="transform: translateX(-50%) rotate(${secondAngle}deg)"></div>
                            <div class="clock-center"></div>
                        </div>
                    </div>
                    <div class="clock-details">
                        <p class="clock-location">Rome, Italy</p>
                        <p class="clock-time"><strong>${displayHours}:${displayMinutes}</strong> <span class="clock-period">${period}</span></p>
                        <p class="clock-meta">${timezoneAbbr} · ${dayName}, ${monthName} ${date}</p>
                    </div>
                </div>
            </li>
        `;
    },

    /**
     * MDN carrot
     * Similar to ad marketplace but with larger image and 2 lines of text
     */
    mdn: () => `
        <li class="search-suggestions-preview-item carrot carrot--local carrot--mdn">
            <span class="ad-marketplace-sponsored">Sponsored</span>
            <div class="local-business local-business--mdn">
                <div class="local-business-image local-business-image--mdn-text">MDN</div>
                <div class="local-business-content">
                    <p class="local-business-name"><strong>MDN</strong> – Mozilla Developer Network</p>
                    <p class="local-business-details">Web documentation and resources</p>
                </div>
            </div>
        </li>
    `,

    /**
     * Happy emoji carrot
     * Vertical list with emoji on left and text on right, clickable to copy
     */
    happyEmoji: () => `
        <li class="search-suggestions-preview-item carrot carrot--emoji">
            <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to homepage</button>
            <div class="emoji-instruction">Click a symbol to copy it</div>
            <div class="emoji-list">
                <div class="emoji-item" data-emoji="😊">
                    <span class="emoji-icon">😊</span>
                    <span class="emoji-label">Happy</span>
                </div>
                <div class="emoji-item" data-emoji="😄">
                    <span class="emoji-icon">😄</span>
                    <span class="emoji-label">Grin</span>
                </div>
                <div class="emoji-item" data-emoji="😁">
                    <span class="emoji-icon">😁</span>
                    <span class="emoji-label">Beam</span>
                </div>
                <div class="emoji-item" data-emoji="😃">
                    <span class="emoji-icon">😃</span>
                    <span class="emoji-label">Smile</span>
                </div>
                <div class="emoji-item" data-emoji="😆">
                    <span class="emoji-icon">😆</span>
                    <span class="emoji-label">Laugh</span>
                </div>
                <div class="emoji-item" data-emoji="😋">
                    <span class="emoji-icon">😋</span>
                    <span class="emoji-label">Yum</span>
                </div>
                <div class="emoji-item" data-emoji="😍">
                    <span class="emoji-icon">😍</span>
                    <span class="emoji-label">Heart</span>
                </div>
                <div class="emoji-item" data-emoji="🤗">
                    <span class="emoji-icon">🤗</span>
                    <span class="emoji-label">Hug</span>
                </div>
                <div class="emoji-item" data-emoji="😎">
                    <span class="emoji-icon">😎</span>
                    <span class="emoji-label">Cool</span>
                </div>
            </div>
        </li>
    `,

    /**
     * YouTube extension carrot
     * Shows YouTube logo and advert for browser extension from addons.mozilla.org
     */
    youtube: () => `
        <li class="search-suggestions-preview-item carrot carrot--youtube">
            <div class="youtube-container">
                <div class="youtube-logo-container">
                    <img src="favicons/YouTube.svg" alt="YouTube" class="youtube-logo">
                </div>
                <div class="youtube-details">
                    <p class="youtube-title">YouTube Browser Extension</p>
                    <p class="youtube-description">Enhance your YouTube experience with our official browser extension</p>
                    <a href="https://addons.mozilla.org" class="youtube-link" target="_blank" rel="noopener noreferrer">Get it from addons.mozilla.org</a>
                </div>
            </div>
        </li>
    `,

    /**
     * VPN carrot
     * Shows controls for turning VPN on/off and selecting tunnel location
     */
    vpn: () => `
        <li class="search-suggestions-preview-item carrot carrot--vpn">
            <div class="vpn-container">
                <div class="vpn-header">
                    <p class="vpn-title">VPN</p>
                    <label class="vpn-toggle">
                        <input type="checkbox" class="vpn-toggle-input" aria-label="Toggle VPN">
                        <span class="vpn-toggle-slider"></span>
                    </label>
                </div>
                <div class="vpn-status">
                    <span class="vpn-status-indicator vpn-status-indicator--off"></span>
                    <span class="vpn-status-text">VPN is off</span>
                </div>
                <div class="vpn-location">
                    <label class="vpn-location-label">Tunnel to:</label>
                    <select class="vpn-location-select" aria-label="Select VPN location">
                        <option value="auto">Auto (fastest)</option>
                        <option value="us">United States</option>
                        <option value="uk">United Kingdom</option>
                        <option value="de">Germany</option>
                        <option value="fr">France</option>
                        <option value="jp">Japan</option>
                        <option value="ca">Canada</option>
                        <option value="au">Australia</option>
                        <option value="nl">Netherlands</option>
                        <option value="se">Sweden</option>
                    </select>
                </div>
            </div>
        </li>
    `,

    /**
     * Currency conversion carrot
     * Shows currency conversion rates and calculator
     */
    currency: (amount, fromCurrency, toCurrency) => {
        // Default values if not provided
        const amt = amount || '100';
        const from = fromCurrency || 'USD';
        const to = toCurrency || 'EUR';
        
        // Mock conversion rate (in real implementation, this would come from an API)
        const conversionRates = {
            'USD': { 'EUR': 0.92, 'GBP': 0.79, 'JPY': 149.50, 'CAD': 1.35, 'AUD': 1.52 },
            'EUR': { 'USD': 1.09, 'GBP': 0.86, 'JPY': 162.50, 'CAD': 1.47, 'AUD': 1.65 },
            'GBP': { 'USD': 1.27, 'EUR': 1.16, 'JPY': 189.50, 'CAD': 1.71, 'AUD': 1.93 },
            'JPY': { 'USD': 0.0067, 'EUR': 0.0062, 'GBP': 0.0053, 'CAD': 0.0090, 'AUD': 0.0102 },
            'CAD': { 'USD': 0.74, 'EUR': 0.68, 'GBP': 0.58, 'JPY': 111.00, 'AUD': 1.13 },
            'AUD': { 'USD': 0.66, 'EUR': 0.61, 'GBP': 0.52, 'JPY': 98.50, 'CAD': 0.88 }
        };
        
        const rate = conversionRates[from] && conversionRates[from][to] ? conversionRates[from][to] : 1;
        const convertedAmount = (parseFloat(amt) * rate).toFixed(2);
        
        return `
        <li class="search-suggestions-preview-item carrot carrot--currency">
            <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to homepage</button>
            <div class="currency-converter">
                <div class="currency-header">
                    <h3 class="currency-title">Currency Converter</h3>
                </div>
                <div class="currency-conversion">
                    <div class="currency-amount">
                        <span class="currency-value">${amt}</span>
                        <span class="currency-code">${from}</span>
                    </div>
                    <div class="currency-arrow">→</div>
                    <div class="currency-amount">
                        <span class="currency-value">${convertedAmount}</span>
                        <span class="currency-code">${to}</span>
                    </div>
                </div>
                <div class="currency-rate">
                    <span class="currency-rate-label">Exchange rate:</span>
                    <span class="currency-rate-value">1 ${from} = ${rate.toFixed(4)} ${to}</span>
                </div>
                <div class="currency-popular">
                    <p class="currency-popular-label">${amt} ${from} in other currencies:</p>
                    <div class="currency-popular-list">
                        ${from !== 'EUR' && to !== 'EUR' ? `<span class="currency-popular-item">${(parseFloat(amt) * (conversionRates[from]?.EUR || 1)).toFixed(2)} EUR</span>` : ''}
                        ${from !== 'GBP' && to !== 'GBP' ? `<span class="currency-popular-item">${(parseFloat(amt) * (conversionRates[from]?.GBP || 1)).toFixed(2)} GBP</span>` : ''}
                        ${from !== 'JPY' && to !== 'JPY' ? `<span class="currency-popular-item">${(parseFloat(amt) * (conversionRates[from]?.JPY || 1)).toFixed(2)} JPY</span>` : ''}
                    </div>
                </div>
            </div>
        </li>
        `;
    },

    /**
     * Translation carrot
     * Shows translation result from AI
     */
    translation: (term, targetLanguage, translationResult) => {
        const displayTerm = term || '';
        const language = targetLanguage || 'italian';
        const translation = translationResult || 'Loading translation...';
        
        return `
        <li class="search-suggestions-preview-item carrot carrot--translation">
            <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to homepage</button>
            <div class="translation-converter">
                <div class="translation-header">
                    <img src="icons/Fx-Browser-icon-fullColor-64.png" alt="" class="translation-icon" aria-hidden="true">
                    <h3 class="translation-title">Firefox Translation</h3>
                </div>
                <div class="translation-content">
                    <div class="translation-original">
                        <span class="translation-label">Original:</span>
                        <span class="translation-term">${displayTerm}</span>
                    </div>
                    <div class="translation-arrow">→</div>
                    <div class="translation-result">
                        <span class="translation-label">${language.charAt(0).toUpperCase() + language.slice(1)}:</span>
                        <span class="translation-text">${translation}</span>
                    </div>
                </div>
            </div>
        </li>
        `;
    },

    /**
     * Renewable energy story card carrot
     * Shows the thought-provoking story card for renewable energy
     */
    renewableEnergy: () => {
        return `
        <li class="search-suggestions-preview-item carrot carrot--story-card">
            <a href="#" class="card" style="display: block; text-decoration: none; color: inherit;">
                <div class="image-placeholder"></div>
                <h2>Breakthroughs in Renewable Energy</h2>
                <p>Eco World</p>
                <p class="sponsored-label">Sponsored</p>
            </a>
        </li>
        `;
    },
};

