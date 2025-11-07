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
        <li class="search-suggestions-preview-item carrot carrot--local">
            <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to New Tab</button>
            <div class="local-business">
                <img src="https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=200&h=200&q=80" alt="Peet's Coffee" class="local-business-image">
                <div class="local-business-content">
                    <p class="local-business-name">Peet's Coffee</p>
                    <p class="local-business-details">1574 Alfredo St, New York · $$ · <span class="local-business-status local-business-status--closed"><strong>Closed</strong> until 10am Mon</span> · <span class="local-business-rating"><span class="star">★</span> 4.3 (1.1k)</span></p>
                </div>
            </div>
        </li>
        <li class="search-suggestions-preview-item carrot carrot--local">
            <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to New Tab</button>
            <div class="local-business">
                <img src="https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=200&h=200&q=80" alt="Blue Bottle Coffee" class="local-business-image">
                <div class="local-business-content">
                    <p class="local-business-name">Blue Bottle Coffee</p>
                    <p class="local-business-details">450 Hayes St, New York · $$$ · <span class="local-business-status"><strong>Open</strong> until 8pm</span> · <span class="local-business-rating"><span class="star">★</span> 4.6 (2.3k)</span></p>
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
            <span class="ad-marketplace-sponsored">Sponsored</span>
            <div class="local-business local-business--ad-marketplace">
                <img src="https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?auto=format&fit=crop&w=28&h=28&q=80" alt="Chairs" class="local-business-image" style="width: 28px; height: 28px;">
                <div class="local-business-content">
                    <p class="local-business-name"><strong>chair</strong> – Bed Bath & Beyond – Official Site</p>
                </div>
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
                        <img src="favicons/Amazon - Light.svg" alt="" class="carrot-big-ad-favicon" role="presentation">
                        Amazon - Official Store
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
            <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to New Tab</button>
            <div class="carrot-tile" aria-hidden="true"></div>
            <div class="carrot-lines">
                <p class="carrot-line"><span class="carrot-line-label">Dep</span> <strong>9:21pm</strong> Chicago (CHI)</p>
                <p class="carrot-line"><span class="carrot-line-label">Arr</span> <strong>11:42am</strong> Vancouver (VYR)</p>
                <p class="carrot-line carrot-line--meta"><span class="carrot-line green-text">In flight</span> · Today · AC 8170</p>
            </div>
        </li>
        <li class="search-suggestions-preview-item carrot">
            <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to New Tab</button>
            <div class="carrot-tile" aria-hidden="true"></div>
            <div class="carrot-lines">
                <p class="carrot-line"><span class="carrot-line-label">Dep</span> <strong>9:21pm</strong> Chicago (CHI)</p>
                <p class="carrot-line"><span class="carrot-line-label">Arr</span> <strong>11:42am</strong> Vancouver (VYR)</p>
                <p class="carrot-line carrot-line--meta">Tomorrow · AC 8170</p>
            </div>
        </li>
        <li class="search-suggestions-preview-item carrot">
            <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to New Tab</button>
            <div class="carrot-tile" aria-hidden="true"></div>
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
            <div class="carrot-text-content">
                <p class="carrot-line carrot-line--title">Fox</p>
                <p class="carrot-line">Foxes are small-to-medium-sized omnivorous mammals belonging to several genera of the family Canidae. They have a flattened skull, upright triangular ears, a pointed, slightly upturned snout, and a long bushy tail. Twelve species belong to the monophyletic "true fox" group of genus Vulpes.</p>
                <a href="https://en.wikipedia.org/wiki/Fox" class="carrot-link" target="_blank" rel="noopener noreferrer">https://en.wikipedia.org/wiki/Fox</a>
            </div>
            <div class="carrot-image-container">
                <img src="https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=300&h=400&q=80" alt="Red Fox" class="carrot-portrait-image">
                <p class="carrot-image-caption">Red Fox (Vulpes vulpes)</p>
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
                <p class="weather-title">Accuweather</p>
                <button class="weather-pin-button" type="button"><span class="pin-icon">📌</span>Pin to New Tab</button>
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
     */
    sports: () => `
        <li class="search-suggestions-preview-item carrot">
            <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to New Tab</button>
            <div class="carrot-tile" aria-hidden="true"></div>
            <div class="carrot-lines">
                <p class="carrot-line">Lakers vs Warriors</p>
                <p class="carrot-line">Live · Q3 <strong>89-92</strong></p>
                <p class="carrot-line carrot-line--meta">8:42 remaining · ESPN</p>
            </div>
        </li>
        <li class="search-suggestions-preview-item carrot">
            <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to New Tab</button>
            <div class="carrot-tile" aria-hidden="true"></div>
            <div class="carrot-lines">
                <p class="carrot-line">Next game</p>
                <p class="carrot-line">Lakers vs Celtics</p>
                <p class="carrot-line carrot-line--meta">Tomorrow · 7:30pm ET</p>
            </div>
        </li>
        <li class="search-suggestions-preview-item carrot">
            <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to New Tab</button>
            <div class="carrot-tile" aria-hidden="true"></div>
            <div class="carrot-lines">
                <p class="carrot-line">Standings</p>
                <p class="carrot-line">Lakers · <strong>32-18</strong></p>
                <p class="carrot-line carrot-line--meta">3rd in Western Conference</p>
            </div>
        </li>
    `,

    /**
     * Stocks carrot
     * Shows stock price, changes, and related financial data
     * Colors: green for positive changes, red for negative changes
     */
    stocks: () => `
        <li class="search-suggestions-preview-item carrot">
            <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to New Tab</button>
            <div class="carrot-tile" aria-hidden="true"></div>
            <div class="carrot-lines">
                <p class="carrot-line">UBER</p>
                <p class="carrot-line"><strong>$73.45</strong> <span class="green-text">+2.18 (3.06%)</span></p>
                <p class="carrot-line carrot-line--meta">NYSE · Updated 4:00pm ET</p>
            </div>
        </li>
        <li class="search-suggestions-preview-item carrot">
            <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to New Tab</button>
            <div class="carrot-tile" aria-hidden="true"></div>
            <div class="carrot-lines">
                <p class="carrot-line">52-week range</p>
                <p class="carrot-line"><strong>$53.12</strong> - <strong>$87.00</strong></p>
                <p class="carrot-line carrot-line--meta">Market cap: $148.2B</p>
            </div>
        </li>
        <li class="search-suggestions-preview-item carrot">
            <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to New Tab</button>
            <div class="carrot-tile" aria-hidden="true"></div>
            <div class="carrot-lines">
                <p class="carrot-line">Related stocks</p>
                <p class="carrot-line">LYFT <strong>$15.32</strong> <span class="red-text">-0.45 (2.85%)</span></p>
                <p class="carrot-line carrot-line--meta">DASH <strong>$182.16</strong> <span class="green-text">+3.21 (1.79%)</span></p>
            </div>
        </li>
    `,

    /**
     * World clock carrot
     * Shows current time in Tokyo with analog clock display
     * Dynamically calculates real-time based on user's device clock
     * 
     * @returns {string} HTML template with current Tokyo time
     */
    worldClock: () => {
        // Calculate current Tokyo time
        const now = new Date();
        const tokyoTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
        
        const hours = tokyoTime.getHours();
        const minutes = tokyoTime.getMinutes();
        const seconds = tokyoTime.getSeconds();
        
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
        const dayName = dayNames[tokyoTime.getDay()];
        const monthName = monthNames[tokyoTime.getMonth()];
        const date = tokyoTime.getDate();
        
        return `
            <li class="search-suggestions-preview-item carrot carrot--clock">
                <button class="carrot-pin-button" type="button"><span class="pin-icon">📌</span>Pin to New Tab</button>
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
                        <p class="clock-location">Tokyo, Japan</p>
                        <p class="clock-time"><strong>${displayHours}:${displayMinutes}</strong> <span class="clock-period">${period}</span></p>
                        <p class="clock-meta">JST (UTC+9) · ${dayName}, ${monthName} ${date}</p>
                    </div>
                </div>
            </li>
        `;
    }
};

