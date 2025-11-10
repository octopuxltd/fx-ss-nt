// ============================================================================
// SUGGESTION PATHS CONFIGURATION
// ============================================================================
// 
// This file defines the search suggestion behavior for different typing sequences.
// It controls what suggestions appear as the user types and when carrots (rich
// preview cards) should be displayed.
//
// STRUCTURE:
// ----------
// suggestionPaths: Object containing named paths (e.g., 'coffee', 'weather', 'fox')
// Each path is an array of objects with:
//   - query: The exact search string to match (case-insensitive)
//   - suggestions: Array of strings to display as search suggestions
//   - carrot (optional): Object defining when to show a preview card
//       - state: Numeric ID for the carrot type (see carrot states below)
//       - content: Content variant ID (matches state in most cases)
//       - color: CSS class for colored text (e.g., 'green-text') or null
//
// CARROT STATES:
// --------------
// 0: Local recommendations (coffee shops, restaurants)
// 1: Flights (airline code + flight number)
// 2: Wikipedia (encyclopedia articles)
// 3: Calculator (math expressions)
// 4: Weather (forecasts and conditions)
// 5: Sports (live scores, schedules)
// 6: Stocks (stock prices, financial data)
// 7: World Clock (time zones)
//
// HOW IT WORKS:
// -------------
// 1. As the user types, the search input is matched against each path's queries
// 2. When a match is found, the suggestions list updates with that query's suggestions
// 3. If the matched query has a carrot defined, it triggers the carrot to slide in
// 4. Carrots persist through subsequent typing unless explicitly removed or state changes
// 5. Deleting back to an empty field resets to the zero-prefix state
//
// ICON MAPPING:
// -------------
// Each suggestion gets an icon based on iconMappings:
//   - lightning: Trending/popular searches (shown first)
//   - clock: User's search history (shown second)
//   - search: General search queries (shown last)
//
// ============================================================================

const suggestionPaths = {
    // ========================================================================
    // COFFEE SHOP PATH
    // ========================================================================
    // Typing sequence: c -> co -> cof -> coff -> coffe -> coffee -> coffee s -> coffee sh -> coffee sho -> coffee shop -> coffee shops
    // Carrot trigger: "coff" (local recommendations carrot shows coffee shops)
    // Purpose: Demonstrates progressive refinement from broad searches to specific local queries
    coffee: [
        {
            query: 'c',
            suggestions: [
                'chatgpt',
                'canva',
                'chrome',
                'concerts near me',
                'champions league',
                'copilot',
                'canvas ucc'
            ]
        },
        {
            query: 'co',
            suggestions: [
                'concerts near me',
                'copilot',
                'companies house',
                'copilot chat',
                'costco',
                'compare the market',
                'cool math games'
            ]
        },
        {
            query: 'cof',
            suggestions: [
                'coffeebean.com',
                'coffee',
                'coffee machine',
                'coffee tables',
                'coface login',
                'coffee beans',
                'coffin ships'
            ]
        },
        {
            query: 'coff',
            suggestions: [
                'coffeebean.com',
                'coffee',
                'coffee machine',
                'coffee tables',
                'coffee beans',
                'coffey construction',
                'coffee shop near me'
            ],
            carrot: {
                state: 1,           // Carrot state ID (see CARROT STATES at top of file)
                content: 0,         // Content variant: 0 = Local recommendations (coffee shops)
                color: null         // No special text coloring
            }
        },
        {
            query: 'coffe',
            suggestions: [
                'coffeebean.com',
                'coffee machines',
                'coffee',
                'coffee tables',
                'coffee beans',
                'coffee shop near me',
                'coffee pods'
            ],
            carrot: {
                state: 1,
                content: 0,
                color: null
            }
        },
        {
            query: 'coffee',
            suggestions: [
                'coffeebean.com',
                'coffee machines',
                'coffee',
                'coffee tables',
                'coffee beans',
                'coffee pods',
                'coffee grinder'
            ],
            carrot: {
                state: 1,
                content: 0,
                color: null
            }
        },
        {
            query: 'coffee ',
            suggestions: [
                'coffee shop near me',
                'coffee recipes',
                'coffee subscription',
                'coffee syrups',
                'coffee shop london',
                'coffee beans delivery',
                'coffee accessories'
            ],
            carrot: {
                state: 1,
                content: 0,
                color: null
            }
        },
        {
            query: 'coffee s',
            suggestions: [
                'coffee shop near me',
                'coffee sachets',
                'coffee syrups',
                'coffee subscription',
                'coffee shop lambeth',
                'coffee shop covent garden',
                'coffee shops london'
            ],
            carrot: {
                state: 1,
                content: 0,
                color: null
            }
        },
        {
            query: 'coffee sh',
            suggestions: [
                'coffee shops near me',
                'coffee shop jobs',
                'coffee shop music',
                'coffee shop enton',
                'coffee shop onslow village',
                'coffee shop game',
                'coffee shop menu'
            ],
            carrot: {
                state: 1,
                content: 0,
                color: null
            }
        },
        {
            query: 'coffee sho',
            suggestions: [
                'coffee shop near me',
                'coffee shops',
                'coffee shop music',
                'coffee shop menu',
                'coffee shop marshes upper',
                'coffee shop mullagharlin',
                'coffee shop game'
            ],
            carrot: {
                state: 1,
                content: 0,
                color: null
            }
        },
        {
            query: 'coffee shop',
            suggestions: [
                'coffee shop near me',
                'coffee shops',
                'coffee shop music',
                'coffee shop menu',
                'coffee shop lambeth',
                'coffee shop covent garden',
                'coffee shop enton'
            ],
            carrot: {
                state: 1,
                content: 0,
                color: null
            }
        },
        {
            query: 'coffee shops',
            suggestions: [
                'coffee shops near me',
                'coffee shops london',
                'coffee shops covent garden',
                'coffee shops open now',
                'coffee shops with wifi',
                'coffee shops hiring',
                'coffee shops soho'
            ],
            carrot: {
                state: 1,
                content: 0,
                color: null
            }
        }
    ],
    
    // ========================================================================
    // FLIGHTS PATH (AC 8170)
    // ========================================================================
    // Typing sequence: a -> ac -> ac  -> ac 8 -> ac 81 -> ac 817 -> ac 8170
    // Carrot trigger: "ac 817" (flight status and itinerary)
    // Purpose: Demonstrates flight tracking with status, schedule, and dates
    // Note: Flight number only appears once user types almost the full number (ac 817)
    //       Spaces are ignored for matching (ac8170 = ac 8170 = ac 81 70)
    flights: [
        {
            query: 'a',
            suggestions: [
                'amazon',
                'apple',
                'amazon prime',
                'airbnb',
                'ancestry',
                'american airlines',
                'asos'
            ]
        },
        {
            query: 'ac',
            suggestions: [
                'accuweather',
                'academy sports',
                'accenture',
                'accounting software',
                'ac repair near me',
                'acorns',
                'acura'
            ]
        },
        {
            query: 'ac ',
            suggestions: [
                'ac milan',
                'ac repair near me',
                'ac units',
                'ac valhalla',
                'ac hotels',
                'ac dc',
                'ac moore'
            ]
        },
        {
            query: 'ac 8',
            suggestions: [
                'ac units 8000 btu',
                'ac 800 flight',
                'ac 850 flight',
                'ac 888 flight',
                'ac 802 flight',
                'ac 857 flight',
                'ac 8 series'
            ]
        },
        {
            query: 'ac8',
            suggestions: [
                'ac units 8000 btu',
                'ac 800 flight',
                'ac 850 flight',
                'ac 888 flight',
                'ac 802 flight',
                'ac 857 flight',
                'ac 8 series'
            ]
        },
        {
            query: 'ac 81',
            suggestions: [
                'ac 8150 flight',
                'ac 8140 flight',
                'ac 8180 flight',
                'ac 8100 flight',
                'ac 810 flight',
                'ac 815 flight',
                'ac 818 flight'
            ]
        },
        {
            query: 'ac81',
            suggestions: [
                'ac 8150 flight',
                'ac 8140 flight',
                'ac 8180 flight',
                'ac 8100 flight',
                'ac 810 flight',
                'ac 815 flight',
                'ac 818 flight'
            ]
        },
        {
            query: 'ac 817',
            suggestions: [
                'ac 8170',
                'ac 8170 flight status',
                'ac 8170 schedule',
                'ac 8170 today',
                'ac 8170 tomorrow',
                'ac 8170 tracking',
                'ac 8171'
            ],
            carrot: {
                state: 2,           // Carrot state ID (see CARROT STATES at top of file)
                content: 1,         // Content variant: 1 = Flights (AC 8170 itinerary)
                color: null         // No special text coloring (green text inline for "In flight")
            }
        },
        {
            query: 'ac817',
            suggestions: [
                'ac 8170',
                'ac 8170 flight status',
                'ac 8170 schedule',
                'ac 8170 today',
                'ac 8170 tomorrow',
                'ac 8170 tracking',
                'ac 8171'
            ],
            carrot: {
                state: 2,           // Carrot state ID (see CARROT STATES at top of file)
                content: 1,         // Content variant: 1 = Flights (AC 8170 itinerary)
                color: null         // No special text coloring (green text inline for "In flight")
            }
        },
        {
            query: 'ac 8170',
            suggestions: [
                'ac 8170',
                'ac 8170 flight status',
                'ac 8170 schedule',
                'ac 8170 today',
                'ac 8170 tomorrow',
                'ac 8170 tracking',
                'ac 8170 arrivals'
            ],
            carrot: {
                state: 2,
                content: 1,
                color: null
            }
        },
        {
            query: 'ac8170',
            suggestions: [
                'ac 8170',
                'ac 8170 flight status',
                'ac 8170 schedule',
                'ac 8170 today',
                'ac 8170 tomorrow',
                'ac 8170 tracking',
                'ac 8170 arrivals'
            ],
            carrot: {
                state: 2,           // Carrot state ID (see CARROT STATES at top of file)
                content: 1,         // Content variant: 1 = Flights (AC 8170 itinerary)
                color: null         // No special text coloring (green text inline for "In flight")
            }
        }
    ],
    
    // ========================================================================
    // LAKERS / SPORTS PATH
    // ========================================================================
    // Typing sequence: l -> la -> lak -> lake -> laker -> lakers -> lakers  -> lakers g -> lakers ga -> lakers gam -> lakers game
    // Carrot trigger: "lakers" (sports scores and game information)
    // Purpose: Demonstrates transitioning from broad 'l' searches to specific sports team queries
    // Note: Early stages include diverse suggestions (lakes, languages, etc.) before narrowing to Lakers content
    lakers: [
        {
            query: 'l',
            suggestions: [
                'linkedin',
                'lakers',
                'lowe\'s',
                'login',
                'lebron james',
                'local weather',
                'library hours'
            ]
        },
        {
            query: 'la',
            suggestions: [
                'lakers',
                'las vegas weather',
                'laptop',
                'language translator',
                'laughing emoji',
                'lastpass',
                'latin america'
            ]
        },
        {
            query: 'lak',
            suggestions: [
                'lakers',
                'lakers game',
                'lake tahoe',
                'lakeside restaurant',
                'lake district',
                'lakers score',
                'lake house rentals'
            ]
        },
        {
            query: 'lake',
            suggestions: [
                'lakers',
                'lakers game',
                'lake tahoe',
                'lakeside restaurant',
                'lake district',
                'lakers score',
                'lake house rentals'
            ]
        },
        {
            query: 'laker',
            suggestions: [
                'lakers',
                'lakers game',
                'lakers score',
                'lakers roster',
                'lakers schedule',
                'lakers news',
                'lakers tickets'
            ]
        },
        {
            query: 'lakers',
            suggestions: [
                'lakers',
                'lakers game',
                'lakers score',
                'lakers roster',
                'lakers schedule',
                'lakers news',
                'lakers tickets'
            ],
            carrot: {
                state: 5,           // Carrot state ID (see CARROT STATES at top of file)
                content: 5,         // Content variant: 5 = Sports (live scores, game schedules)
                color: null         // No special text coloring
            }
        },
        {
            query: 'lakers ',
            suggestions: [
                'lakers game',
                'lakers score',
                'lakers roster',
                'lakers schedule',
                'lakers news',
                'lakers tickets',
                'lakers vs warriors'
            ],
            carrot: {
                state: 5,
                content: 5,
                color: null
            }
        },
        {
            query: 'lakers g',
            suggestions: [
                'lakers game',
                'lakers game tonight',
                'lakers game live',
                'lakers game score',
                'lakers game schedule',
                'lakers game today',
                'lakers game tickets'
            ],
            carrot: {
                state: 5,
                content: 5,
                color: null
            }
        },
        {
            query: 'lakers ga',
            suggestions: [
                'lakers game',
                'lakers game tonight',
                'lakers game live',
                'lakers game score',
                'lakers game schedule',
                'lakers game today',
                'lakers game tickets'
            ],
            carrot: {
                state: 5,
                content: 5,
                color: null
            }
        },
        {
            query: 'lakers gam',
            suggestions: [
                'lakers game',
                'lakers game tonight',
                'lakers game live',
                'lakers game score',
                'lakers game schedule',
                'lakers game today',
                'lakers game tickets'
            ],
            carrot: {
                state: 5,
                content: 5,
                color: null
            }
        },
        {
            query: 'lakers game',
            suggestions: [
                'lakers game',
                'lakers game tonight',
                'lakers game live',
                'lakers game score',
                'lakers game schedule',
                'lakers game today',
                'lakers game tickets'
            ],
            carrot: {
                state: 5,
                content: 5,
                color: null
            }
        }
    ],
    
    // ========================================================================
    // UBER STOCK PATH
    // ========================================================================
    // Typing sequence: u -> ub -> ube -> uber -> uber  -> uber s -> uber st -> uber sto -> uber stoc -> uber stock
    // Carrot trigger: "uber sto" (stock price and financial data carrot)
    // Purpose: Demonstrates transitioning from general Uber searches to specific stock information
    uber: [
        {
            query: 'u',
            suggestions: [
                'uber',
                'usps tracking',
                'united airlines',
                'ups tracking',
                'uber eats',
                'youtube',
                'urban outfitters'
            ]
        },
        {
            query: 'ub',
            suggestions: [
                'uber',
                'uber eats',
                'uber stock',
                'ups tracking',
                'usps tracking',
                'uber driver',
                'uber careers'
            ]
        },
        {
            query: 'ube',
            suggestions: [
                'uber',
                'uber eats',
                'uber stock',
                'uber driver',
                'uber careers',
                'uber app',
                'uber support'
            ]
        },
        {
            query: 'uber',
            suggestions: [
                'uber',
                'uber eats',
                'uber stock',
                'uber driver',
                'uber careers',
                'uber app',
                'uber support'
            ]
        },
        {
            query: 'uber ',
            suggestions: [
                'uber eats',
                'uber stock',
                'uber driver',
                'uber careers',
                'uber rides',
                'uber app',
                'uber promo code'
            ]
        },
        {
            query: 'uber s',
            suggestions: [
                'uber stock',
                'uber support',
                'uber schedule ride',
                'uber stock price',
                'uber sign in',
                'uber share price',
                'uber safety'
            ]
        },
        {
            query: 'uber st',
            suggestions: [
                'uber stock',
                'uber stock price',
                'uber stock forecast',
                'uber stock news',
                'uber stock analysis',
                'uber stock ticker',
                'uber stock today'
            ]
        },
        {
            query: 'uber sto',
            suggestions: [
                'uber stock',
                'uber stock price',
                'uber stock forecast',
                'uber stock news',
                'uber stock analysis',
                'uber stock ticker',
                'uber stock today'
            ],
            carrot: {
                state: 6,           // Carrot state ID (see CARROT STATES at top of file)
                content: 6,         // Content variant: 6 = Stocks (stock prices, financial data)
                color: null         // No global color - colors are applied inline per value
            }
        },
        {
            query: 'uber stoc',
            suggestions: [
                'uber stock',
                'uber stock price',
                'uber stock forecast',
                'uber stock news',
                'uber stock analysis',
                'uber stock today',
                'uber stock chart'
            ],
            carrot: {
                state: 6,
                content: 6,
                color: null
            }
        },
        {
            query: 'uber stock',
            suggestions: [
                'uber stock',
                'uber stock price',
                'uber stock forecast',
                'uber stock news',
                'uber stock analysis',
                'uber stock today',
                'uber stock chart'
            ],
            carrot: {
                state: 6,
                content: 6,
                color: null
            }
        }
    ],
    
    // ========================================================================
    // TIME TOKYO / WORLD CLOCK PATH
    // ========================================================================
    // Typing sequence: t -> ti -> tim -> time -> time  -> time t -> time to -> time tok -> time toky -> time tokyo
    // Carrot trigger: "time toky" (world clock showing Tokyo time with analog clock)
    // Purpose: Demonstrates timezone and world clock lookup functionality
    time: [
        {
            query: 't',
            suggestions: [
                'twitter',
                'tiktok',
                'target',
                'tesla',
                'time',
                'translate',
                'tesco'
            ]
        },
        {
            query: 'ti',
            suggestions: [
                'tiktok',
                'time',
                'times table',
                'ticketmaster',
                'time zones',
                'tinder',
                'timberland'
            ]
        },
        {
            query: 'tim',
            suggestions: [
                'time',
                'time zones',
                'times table',
                'timetable',
                'time calculator',
                'time now',
                'time converter'
            ]
        },
        {
            query: 'time',
            suggestions: [
                'time',
                'time zones',
                'time now',
                'time in london',
                'time in new york',
                'time in tokyo',
                'time converter'
            ]
        },
        {
            query: 'time ',
            suggestions: [
                'time in london',
                'time in new york',
                'time in tokyo',
                'time zones',
                'time converter',
                'time calculator',
                'time in paris'
            ]
        },
        {
            query: 'time t',
            suggestions: [
                'time in toronto',
                'time table',
                'time in tokyo',
                'time tokyo',
                'time zones',
                'time converter',
                'time in texas'
            ]
        },
        {
            query: 'time to',
            suggestions: [
                'time in toronto',
                'time today',
                'time in tokyo',
                'time tokyo',
                'time zones',
                'time converter',
                'time in london'
            ]
        },
        {
            query: 'time tok',
            suggestions: [
                'time tokyo',
                'time in tokyo',
                'tokyo time zone',
                'tokyo time now',
                'tokyo time difference',
                'time zones',
                'time converter'
            ]
        },
        {
            query: 'time toky',
            suggestions: [
                'time tokyo',
                'time in tokyo',
                'tokyo time zone',
                'tokyo time now',
                'tokyo time difference',
                'tokyo time converter',
                'tokyo clock'
            ],
            carrot: {
                state: 7,           // Carrot state ID (see CARROT STATES at top of file)
                content: 7,         // Content variant: 7 = World Clock (Tokyo time with analog clock)
                color: null         // No special text coloring
            }
        },
        {
            query: 'time tokyo',
            suggestions: [
                'time tokyo',
                'time in tokyo',
                'tokyo time zone',
                'tokyo time now',
                'tokyo time difference',
                'tokyo time converter',
                'tokyo clock'
            ],
            carrot: {
                state: 7,
                content: 7,
                color: null
            }
        }
    ],
    
    // ========================================================================
    // WEATHER PATH
    // ========================================================================
    // Typing sequence: w -> we -> wea -> weat -> weath -> weathe -> weather
    // Carrot trigger: "weath" (weather forecast carrot with 5-day outlook)
    // Purpose: Shows refinement from broad 'w' searches to specific weather queries
    // Note: Includes location-specific suggestions like "weather in new york"
    weather: [
        {
            query: 'w',
            suggestions: [
                'weather',
                'wikipedia',
                'walmart',
                'whatsapp',
                'wordpress',
                'wayfair',
                'word counter'
            ]
        },
        {
            query: 'we',
            suggestions: [
                'weather',
                'wells fargo',
                'webmd',
                'west elm',
                'wegmans',
                'weather forecast',
                'wedding venues'
            ]
        },
        {
            query: 'wea',
            suggestions: [
                'weather',
                'weather forecast',
                'weather tomorrow',
                'weather radar',
                'wearable technology',
                'wealth management',
                'weather today'
            ]
        },
        {
            query: 'weat',
            suggestions: [
                'weather',
                'weather forecast',
                'weather tomorrow',
                'weather radar',
                'weather today',
                'weather this week',
                'weather channel'
            ]
        },
        {
            query: 'weath',
            suggestions: [
                'weather',
                'weather forecast',
                'weather tomorrow',
                'weather today',
                'weather radar',
                'weather this week',
                'weather app'
            ],
            carrot: {
                state: 4,           // Carrot state ID (see CARROT STATES at top of file)
                content: 4,         // Content variant: 4 = Weather forecast (5-day outlook)
                color: 'green-text' // CSS class for green-colored text in carrot
            }
        },
        {
            query: 'weathe',
            suggestions: [
                'weather',
                'weather forecast',
                'weather tomorrow',
                'weather today',
                'weather near me',
                'weather in new york',
                'weather alerts'
            ],
            carrot: {
                state: 4,
                content: 4,
                color: 'green-text'
            }
        },
        {
            query: 'weather',
            suggestions: [
                'weather',
                'weather forecast',
                'weather tomorrow',
                'weather today',
                'weather near me',
                'weather in new york',
                'weather radar'
            ],
            carrot: {
                state: 4,
                content: 4,
                color: 'green-text'
            }
        }
    ],
    
    // ========================================================================
    // FOX WIKIPEDIA PATH
    // ========================================================================
    // Typing sequence: f -> fo -> fox -> fox  -> fox w -> fox wi -> fox wik -> fox wiki
    // Carrot trigger: "fox wik" (Wikipedia article preview for foxes)
    // Purpose: Demonstrates transitioning from news/general content to encyclopedia lookup
    fox: [
        {
            query: 'f',
            suggestions: [
                'fox news',
                'firefox',
                'facebook',
                'fortnite',
                'figma',
                'fox terrier'
            ]
        },
        {
            query: 'fo',
            suggestions: [
                'fox news',
                'fortnite',
                'fox terrier',
                'formula 1',
                'football',
                'ford cars'
            ]
        },
        {
            query: 'fox',
            suggestions: [
                'fox news',
                'fox sports',
                'fox weather',
                'fox terrier',
                'foxes',
                'fox hunting',
                'fox population uk'
            ]
        },
        {
            query: 'fox ',
            suggestions: [
                'fox news',
                'fox sports',
                'fox weather',
                'fox terrier',
                'fox hunting',
                'fox population uk',
                'fox facts'
            ]
        },
        {
            query: 'fox w',
            suggestions: [
                'fox weather',
                'fox wikipedia',
                'fox wiki',
                'fox tv shows',
                'fox pictures',
                'fox documentary'
            ]
        },
        {
            query: 'fox wi',
            suggestions: [
                'fox wikipedia',
                'fox wiki',
                'fox wildlife',
                'fox winter coat',
                'fox cubs',
                'fox behaviour'
            ]
        },
        {
            query: 'fox wik',
            suggestions: [
                'fox wikipedia',
                'fox wiki',
                'red fox wikipedia',
                'arctic fox wiki',
                'grey fox wiki'
            ],
            carrot: {
                state: 3,           // Carrot state ID (see CARROT STATES at top of file)
                content: 2,         // Content variant: 2 = Wikipedia article preview
                color: null         // No special text coloring
            }
        },
        {
            query: 'fox wiki',
            suggestions: [
                'fox wikipedia',
                'fox wiki',
                'red fox wikipedia',
                'arctic fox wiki',
                'grey fox wiki',
                'fennec fox wiki'
            ],
            carrot: {
                state: 3,
                content: 2,
                color: null
            }
        }
    ],
    
    // ========================================================================
    // WIKI FOX PATH
    // ========================================================================
    // Typing sequence: w -> wi -> wik -> wiki -> wiki  -> wiki f -> wiki fo -> wiki fox
    // Carrot trigger: "wiki fox" (Wikipedia article preview for foxes)
    // Purpose: Alternative trigger phrase for Wikipedia fox article
    wikifox: [
        {
            query: 'w',
            suggestions: [
                'weather',
                'wikipedia',
                'walmart',
                'whatsapp',
                'wordpress',
                'wayfair',
                'word counter'
            ]
        },
        {
            query: 'wi',
            suggestions: [
                'wikipedia',
                'windows',
                'wifi',
                'wix',
                'wireless headphones',
                'winter clothing',
                'wish'
            ]
        },
        {
            query: 'wik',
            suggestions: [
                'wikipedia',
                'wiki',
                'wiki leaks',
                'wikihow',
                'wiktionary',
                'wikimedia',
                'wikiwand'
            ]
        },
        {
            query: 'wiki',
            suggestions: [
                'wikipedia',
                'wiki',
                'wiki leaks',
                'wikihow',
                'wiktionary',
                'wikimedia',
                'wikiwand'
            ]
        },
        {
            query: 'wiki ',
            suggestions: [
                'wikipedia',
                'wiki leaks',
                'wikihow',
                'wiki fox',
                'wiki animal',
                'wiki search',
                'wiki page'
            ]
        },
        {
            query: 'wiki f',
            suggestions: [
                'wiki fox',
                'wiki football',
                'wiki facts',
                'wiki file',
                'wiki format',
                'wiki food',
                'wiki fiction'
            ]
        },
        {
            query: 'wiki fo',
            suggestions: [
                'wiki fox',
                'wiki football',
                'wiki food',
                'wiki format',
                'wiki folder',
                'wiki font',
                'wiki form'
            ]
        },
        {
            query: 'wiki fox',
            suggestions: [
                'wiki fox',
                'fox wikipedia',
                'fox wiki',
                'red fox wikipedia',
                'arctic fox wiki',
                'grey fox wiki',
                'fennec fox wiki'
            ],
            carrot: {
                state: 3,
                content: 2,
                color: null
            }
        }
    ],
    
    // ========================================================================
    // CHAIR / AD MARKETPLACE PATH
    // ========================================================================
    // Typing sequence: c -> ch -> cha -> chai -> chair
    // Carrot trigger: "chair" (ad marketplace carrot with sponsored chair listings)
    // Purpose: Demonstrates ad marketplace functionality with horizontal carrot display
    chair: [
        {
            query: 'c',
            suggestions: [
                'chatgpt',
                'canva',
                'chrome',
                'concerts near me',
                'champions league',
                'copilot',
                'canvas ucc'
            ]
        },
        {
            query: 'ch',
            suggestions: [
                'chrome',
                'chatgpt',
                'champions league',
                'chase bank',
                'cheap flights',
                'chicago weather',
                'chocolate cake recipe'
            ]
        },
        {
            query: 'cha',
            suggestions: [
                'chase bank',
                'champions league',
                'charlotte',
                'charlie brown',
                'championship',
                'charleston',
                'challenge'
            ]
        },
        {
            query: 'chai',
            suggestions: [
                'chair',
                'chair covers',
                'chair cushions',
                'chair mat',
                'chair pad',
                'chair lift',
                'chair yoga'
            ]
        },
        {
            query: 'chair',
            suggestions: [
                'chair',
                'office chair',
                'dining chair',
                'gaming chair',
                'ergonomic chair',
                'desk chair',
                'armchair'
            ],
            carrot: {
                state: 8,
                content: 8,
                color: null
            }
        }
    ],

    // ========================================================================
    // SNEAKERS PATH
    // ========================================================================
    // Typing sequence: s -> sn -> sne -> snea -> sneak -> sneake -> sneakers
    // Carrot trigger: "sneake" (big ad carrot shows sneakers article card)
    // Purpose: Demonstrates large article-style ad carrot
    sneakers: [
        {
            query: 's',
            suggestions: [
                'spotify',
                'stack overflow',
                'steam',
                'soundcloud',
                'slack',
                'shopify',
                'skype'
            ]
        },
        {
            query: 'sn',
            suggestions: [
                'snapchat',
                'snowflake',
                'snap',
                'snapchat web',
                'snapchat login',
                'snapchat download',
                'snapchat support'
            ]
        },
        {
            query: 'sne',
            suggestions: [
                'sneakers',
                'sneaker',
                'sneakerhead',
                'sneaker store',
                'sneaker brands',
                'sneaker release dates',
                'sneaker news'
            ]
        },
        {
            query: 'snea',
            suggestions: [
                'sneakers',
                'sneaker',
                'sneakerhead',
                'sneaker store',
                'sneaker brands',
                'sneaker release dates',
                'sneaker news'
            ]
        },
        {
            query: 'sneak',
            suggestions: [
                'sneakers',
                'sneaker',
                'sneakerhead',
                'sneaker store',
                'sneaker brands',
                'sneaker release dates',
                'sneaker news'
            ]
        },
        {
            query: 'sneake',
            suggestions: [
                'sneakers',
                'sneaker',
                'sneakerhead',
                'sneaker store',
                'sneaker brands',
                'sneaker release dates',
                'sneaker news'
            ],
            carrot: {
                state: 9,
                content: 9,
                color: null
            }
        },
        {
            query: 'sneakers',
            suggestions: [
                'sneakers',
                'sneaker',
                'sneakerhead',
                'sneaker store',
                'sneaker brands',
                'sneaker release dates',
                'sneaker news'
            ],
            carrot: {
                state: 9,
                content: 9,
                color: null
            }
        }
    ],

    // ========================================================================
    // MDN PATH
    // ========================================================================
    mdn: [
        {
            query: 'm',
            suggestions: [
                'mdn',
                'microsoft',
                'mail',
                'maps',
                'messenger',
                'music',
                'mcdonalds'
            ]
        },
        {
            query: 'md',
            suggestions: [
                'mdn',
                'mdn web docs',
                'mdn javascript',
                'mdn css',
                'mdn html',
                'mdn mozilla'
            ]
        },
        {
            query: 'mdn',
            suggestions: [
                'mdn',
                'mdn web docs',
                'mdn javascript',
                'mdn css',
                'mdn html',
                'mdn mozilla',
                'mdn documentation'
            ],
            carrot: {
                state: 10,
                content: 10,
                color: null
            }
        }
    ],

    // ========================================================================
    // HAPPY EMOJI PATH
    // ========================================================================
    happyEmoji: [
        {
            query: 'h',
            suggestions: [
                'happy',
                'happy emoji',
                'hotmail',
                'hulu',
                'home depot',
                'hbo',
                'hulu login'
            ]
        },
        {
            query: 'ha',
            suggestions: [
                'happy',
                'happy emoji',
                'harry potter',
                'harvard',
                'harbor freight',
                'harry styles',
                'hack'
            ]
        },
        {
            query: 'hap',
            suggestions: [
                'happy',
                'happy emoji',
                'happy birthday',
                'happy new year',
                'happy hour',
                'happy meal',
                'happy face'
            ]
        },
        {
            query: 'happ',
            suggestions: [
                'happy',
                'happy emoji',
                'happy birthday',
                'happy new year',
                'happy hour',
                'happy meal',
                'happy face'
            ]
        },
        {
            query: 'happy',
            suggestions: [
                'happy',
                'happy emoji',
                'happy birthday',
                'happy new year',
                'happy hour',
                'happy meal',
                'happy face'
            ],
            carrot: {
                state: 11,
                content: 11,
                color: null
            }
        },
        {
            query: 'happy e',
            suggestions: [
                'happy emoji',
                'happy emoji copy',
                'happy emoji text',
                'happy emoji meaning',
                'happy emoji list'
            ],
            carrot: {
                state: 11,
                content: 11,
                color: null
            }
        },
        {
            query: 'happy em',
            suggestions: [
                'happy emoji',
                'happy emoji copy',
                'happy emoji text',
                'happy emoji meaning',
                'happy emoji list'
            ],
            carrot: {
                state: 11,
                content: 11,
                color: null
            }
        },
        {
            query: 'happy emo',
            suggestions: [
                'happy emoji',
                'happy emoji copy',
                'happy emoji text',
                'happy emoji meaning',
                'happy emoji list'
            ],
            carrot: {
                state: 11,
                content: 11,
                color: null
            }
        },
        {
            query: 'happy emoj',
            suggestions: [
                'happy emoji',
                'happy emoji copy',
                'happy emoji text',
                'happy emoji meaning',
                'happy emoji list'
            ],
            carrot: {
                state: 11,
                content: 11,
                color: null
            }
        },
        {
            query: 'happy emoji',
            suggestions: [
                'happy emoji',
                'happy emoji copy',
                'happy emoji text',
                'happy emoji meaning',
                'happy emoji list'
            ],
            carrot: {
                state: 11,
                content: 11,
                color: null
            }
        }
    ]
};

// ============================================================================
// ICON MAPPINGS
// ============================================================================
//
// This object maps suggestion text to icon types. Icons help users understand
// the nature of each search suggestion.
//
// ICON TYPES:
// -----------
// 1. lightning (icons/lightning.svg) - Trending/popular searches
//    - Filled lightning bolt icon
//    - Displayed FIRST in suggestion lists
//    - Use for: Popular searches, trending topics, frequently accessed sites
//
// 2. clock (icons/clock.svg) - User's search history
//    - Clock icon
//    - Displayed SECOND in suggestion lists
//    - Use for: Previous searches, recently visited pages
//    - DEFAULT icon if suggestion text is not found in any mapping
//
// 3. search (icons/search.svg) - General search queries
//    - Magnifying glass icon
//    - Displayed LAST in suggestion lists
//    - Use for: Search actions, discovery queries, exploratory searches
//
// DISPLAY ORDER:
// --------------
// Suggestions are automatically sorted by icon type regardless of their
// original order in the suggestions array:
//   1. All lightning icon suggestions
//   2. All clock icon suggestions
//   3. All search icon suggestions
//
// HOW TO ADD NEW MAPPINGS:
// -------------------------
// Simply add the suggestion text to the appropriate array below.
// The text must match exactly (case-sensitive) with what appears in
// the suggestionPaths suggestions arrays.
//
// ============================================================================

const iconMappings = {
    // Lightning bolt icon - trending searches
    lightning: [
        'chatgpt', 'canva', 'chrome', 'concerts near me', 'copilot',
        'companies house', 'copilot chat', 'coffeebean.com', 'coffee',
        'coffee machine', 'coffee tables', 'fox news', 'fox sports', 
        'fox weather', 'firefox', 'coffee shops near me', 'coffee shop near me',
        'coffee machines', 'weather', 'weather forecast', 'weather tomorrow',
        'weather today', 'wikipedia', 'walmart', 'whatsapp', 'linkedin',
        'lakers', 'lakers game', 'lakers score', 'lakers game tonight',
        'lakers game live', 'las vegas weather', 'laptop', 'wells fargo',
        'webmd', 'uber', 'uber eats', 'uber stock', 'usps tracking',
        'united airlines', 'youtube', 'twitter', 'tiktok', 'target',
        'tesla', 'time', 'translate', 'amazon', 'apple', 'amazon prime',
        'airbnb', 'accuweather', 'american airlines', 'wiki', 'windows', 'wifi',
        'chair', 'office chair', 'dining chair', 'gaming chair', 'ergonomic chair',
        'mdn', 'mdn web docs', 'mdn javascript', 'mdn css', 'mdn html', 'mdn mozilla',
        'happy', 'happy emoji', 'happy emoji copy', 'happy emoji text'
    ],
    
    // Magnifying glass icon - search queries
    search: [
        'champions league', 'costco', 'compare the market', 'coffee beans',
        'coffin ships', 'coffee shop near me', 'coffee pods', 'fox hunting',
        'fox population uk', 'fox facts', 'coffee sachets', 'coffee syrups',
        'coffee subscription', 'coffee shop lambeth', 'coffee shop covent garden',
        'coffee shops london', 'coffee shop music', 'coffee shop menu',
        'coffee shop enton', 'coffee shop onslow village', 'coffee shop game',
        'coffee shop marshes upper', 'coffee shop mullagharlin', 'coffee shops covent garden',
        'coffee shops open now', 'coffee shops with wifi', 'coffee shops hiring',
        'coffee shops soho', 'weather radar', 'weather this week', 'weather channel',
        'lakers roster', 'lakers schedule', 'lakers news', 'lakers tickets',
        'lakers vs warriors', 'lakers game score', 'lakers game schedule',
        'lakers game today', 'lakers game tickets', 'lake tahoe', 'lakeside restaurant',
        'lake district', 'lake house rentals', 'language translator', 'laughing emoji',
        'local weather', 'library hours', 'west elm', 'wegmans', 'wedding venues',
        'wearable technology', 'wealth management', 'word counter', 'weather app',
        'weather near me', 'weather alerts', 'weather map', 'weather next week',
        'weather hourly', 'weather in new york', 'uber stock price', 'uber stock forecast',
        'uber stock news', 'uber stock analysis', 'uber stock ticker', 'uber stock today',
        'uber stock chart', 'uber driver', 'uber careers', 'uber app', 'uber support',
        'uber schedule ride', 'uber sign in', 'uber share price', 'uber safety',
        'uber rides', 'uber promo code', 'ups tracking', 'urban outfitters',
        'time zones', 'time now', 'time in tokyo', 'time converter', 'time calculator',
        'time and date', 'time in london', 'time in new york', 'time in paris',
        'time table', 'time in toronto', 'time in texas', 'time today',
        'tokyo time zone', 'tokyo time now', 'tokyo time difference', 'tokyo time converter',
        'tokyo clock', 'time tokyo', 'times table', 'timetable', 'ticketmaster',
        'tinder', 'timberland', 'tesco', 'ac 8170 flight status', 'ac 8170 schedule',
        'ac 8170 today', 'ac 8170 tomorrow', 'ac 8170 tracking', 'ac 8170 arrivals',
        'ac milan', 'ac repair near me', 'ac units', 'ac valhalla', 'ac hotels',
        'academy sports', 'accenture', 'accounting software', 'ancestry', 'asos',
        'ac 8170', 'ac units 8000 btu', 'ac 800 flight', 'ac 850 flight',
        'ac 888 flight', 'ac 802 flight', 'ac 857 flight', 'ac 8 series',
        'ac 8150 flight', 'ac 8140 flight', 'ac 8180 flight', 'ac 8100 flight',
        'ac 810 flight', 'ac 815 flight', 'ac 818 flight', 'ac 8171', 'ac dc',
        'ac moore', 'acura',         'wiki leaks', 'wikihow', 'wiktionary', 'wikimedia',
        'wikiwand', 'wiki fox', 'wiki animal', 'wiki search', 'wiki page',
        'wiki football', 'wiki facts', 'wiki file', 'wiki format', 'wiki food',
        'wiki fiction', 'wiki folder', 'wiki font', 'wiki form', 'wix',
        'wireless headphones', 'winter clothing', 'wish', 'wordpress', 'wayfair',
        'sneakers', 'sneaker', 'sneakerhead', 'sneaker store', 'sneaker brands',
        'sneaker release dates', 'sneaker news'
    ]
    
    // Default is clock icon (history)
};

