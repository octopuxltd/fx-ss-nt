// Step 1 JavaScript

// ===== API CONFIGURATION =====
// Load saved provider from localStorage, or default to OpenAI
let AI_PROVIDER = localStorage.getItem('ai_provider') || 'openai';

// Model mapping for different providers
const MODEL_MAP = {
    'openrouter-haiku': 'anthropic/claude-3-haiku',
    'openai': 'gpt-4o-mini'
};

const OPENROUTER_API_KEY = window.API_CONFIG?.OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const CLAUDE_API_KEY = window.API_CONFIG?.CLAUDE_API_KEY || '';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_API_KEY = window.API_CONFIG?.OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

console.log('[API CONFIG] Provider:', AI_PROVIDER);
console.log('[API CONFIG] OpenRouter key present:', !!OPENROUTER_API_KEY);
console.log('[API CONFIG] OpenAI key present:', !!OPENAI_API_KEY);
console.log('[API CONFIG] Claude key present:', !!CLAUDE_API_KEY);

console.log('[INIT] Script loading, checking reduced motion in localStorage');
const initialReducedMotion = localStorage.getItem('reduced_motion_enabled');
console.log('[INIT] Reduced motion in localStorage:', initialReducedMotion);

document.addEventListener('DOMContentLoaded', () => {
    console.log('[DOM] DOMContentLoaded fired');
    console.log('[DOM] Body has reduced-motion class?', document.body.classList.contains('reduced-motion'));
    const searchInput = document.querySelector('.search-input');
    const searchContainer = document.querySelector('.search-container');
    const firefoxLogo = document.querySelector('.firefox-logo');
    const searchBoxWrapper = document.querySelector('.search-box-wrapper');
    const searchBoxWrapperOuter = document.querySelector('.search-box-wrapper-outer');
    const reducedMotionCheckbox = document.querySelector('.reduced-motion-checkbox');
    const suggestionsList = document.querySelector('.suggestions-list');
    const suggestionItems = document.querySelectorAll('.suggestion-item');
    const searchSwitcherButton = document.querySelector('.search-switcher-button');
    
    // Click on search-box-wrapper focuses the input
    if (searchBoxWrapper && searchInput) {
        searchBoxWrapper.addEventListener('click', (e) => {
            // Don't focus if clicking on a button
            if (e.target.closest('.search-switcher-button') || e.target.closest('.search-button')) {
                return;
            }
            searchInput.focus();
        });
    }
    
    // Close switcher dropdown when hovering over suggestion items or headings
    if (suggestionsList && searchSwitcherButton) {
        // Delegate to handle both existing items and any future items
        suggestionsList.addEventListener('mouseover', (e) => {
            const target = e.target.closest('.suggestion-item, .suggestions-heading');
            if (target && searchSwitcherButton.classList.contains('open')) {
                console.log('[SUGGESTION ITEM HOVER] Closing switcher dropdown');
                searchSwitcherButton.classList.remove('open');
            }
        });
    }
    
    // Handle search switcher button dropdown
    if (searchSwitcherButton) {
        searchSwitcherButton.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent input from blurring
        });
        
        searchSwitcherButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasOpen = searchSwitcherButton.classList.contains('open');
            searchSwitcherButton.classList.toggle('open');
            const isNowOpen = searchSwitcherButton.classList.contains('open');
            
            console.log('[SWITCHER CLICK] Clicked search switcher button');
            console.log('[SWITCHER CLICK] Was open:', wasOpen, '→ Now open:', isNowOpen);
            console.log('[SWITCHER CLICK] Search input focused?', document.activeElement === searchInput);
            console.log('[SWITCHER CLICK] Suggestions visible?', searchContainer?.classList.contains('focused'));
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-switcher-button')) {
                const wasOpen = searchSwitcherButton.classList.contains('open');
                if (wasOpen) {
                    console.log('[OUTSIDE CLICK] Closing switcher dropdown');
                }
                searchSwitcherButton.classList.remove('open');
            }
        });
    }
    
    // Handle reduced motion checkbox
    if (reducedMotionCheckbox) {
        // Load saved state from localStorage
        const savedReducedMotion = localStorage.getItem('reduced_motion_enabled');
        console.log('[CHECKBOX] Saved reduced motion:', savedReducedMotion);
        if (savedReducedMotion === 'true') {
            console.log('[CHECKBOX] Adding reduced-motion class to body');
            reducedMotionCheckbox.checked = true;
            document.body.classList.add('reduced-motion');
            console.log('[CHECKBOX] Body classes after add:', document.body.className);
        }
        
        reducedMotionCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('reduced-motion');
                localStorage.setItem('reduced_motion_enabled', 'true');
            } else {
                document.body.classList.remove('reduced-motion');
                localStorage.setItem('reduced_motion_enabled', 'false');
            }
        });
    }
    
    // Calculate and set border radius based on wrapper height
    const updateBorderRadius = () => {
        console.log('[BORDER-RADIUS] Calculating border radiuses...');
        
        if (searchBoxWrapper && searchBoxWrapperOuter) {
            const wrapperHeight = searchBoxWrapper.offsetHeight;
            const borderRadius = wrapperHeight / 2;
            const gradientBorderRadius = borderRadius + 2;

            searchBoxWrapper.style.borderRadius = `${borderRadius}px`;
            searchBoxWrapperOuter.style.borderRadius = `${borderRadius}px`;
            
            const outerComputedRadius = getComputedStyle(searchBoxWrapperOuter).borderRadius;
            const innerComputedRadius = getComputedStyle(searchBoxWrapper).borderRadius;
            
            console.log('[BORDER-RADIUS] Search box wrapper:', {
                wrapperHeight: wrapperHeight,
                calculatedInnerRadius: borderRadius,
                calculatedOuterRadius: borderRadius,
                calculatedGradientRadius: gradientBorderRadius,
                renderedInnerRadius: innerComputedRadius,
                renderedOuterRadius: outerComputedRadius
            });
            
            // The ::before element needs extra radius since it extends outward by 2px
            document.documentElement.style.setProperty('--outer-border-radius', `${gradientBorderRadius}px`);
        }
        
        // Set search-switcher-button border radius to half its height
        const searchSwitcherBtn = document.querySelector('.search-switcher-button');
        if (searchSwitcherBtn) {
            const buttonHeight = searchSwitcherBtn.offsetHeight;
            const buttonBorderRadius = buttonHeight / 2;
            document.documentElement.style.setProperty('--switcher-button-radius', `${buttonBorderRadius}px`);
            
            console.log('[BORDER-RADIUS] Search switcher button:', {
                height: buttonHeight,
                radius: buttonBorderRadius
            });
        }

        // Set suggestion items border radius to half the first item's height
        const firstSuggestionItem = document.querySelector('.suggestion-item');
        if (firstSuggestionItem) {
            const itemHeight = firstSuggestionItem.offsetHeight;
            const itemBorderRadius = itemHeight / 2;
            document.documentElement.style.setProperty('--suggestion-item-radius', `${itemBorderRadius}px`);
            
            console.log('[BORDER-RADIUS] Suggestion items:', {
                height: itemHeight,
                radius: itemBorderRadius
            });
        }
    };
    
    // Set initial border radius
    updateBorderRadius();
    
    // Update on window resize
    window.addEventListener('resize', updateBorderRadius);
    
    let firstHoverDone = false;
    let gradientAnimationId = null;
    let gradientAngle = 0;
    
    // Animate gradient border
    const animateGradient = () => {
        gradientAngle = (gradientAngle + 1) % 360;
        
        let style = document.getElementById('gradient-animation-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'gradient-animation-style';
        }
        style.textContent = `.search-box-wrapper-outer:focus-within::before { background: conic-gradient(from ${gradientAngle}deg, #FF00FF 0%, #FFA500 35%, #FFFFFF 50%, #FFA500 65%, #FF00FF 100%); }`;
        if (!document.head.contains(style)) {
            document.head.appendChild(style);
        }
        gradientAnimationId = requestAnimationFrame(animateGradient);
    };
    
    if (searchInput && searchContainer) {
        searchInput.addEventListener('focus', () => {
            // Add focused class to expand width
            searchContainer.classList.add('focused');
            
            // Reset first hover flag
            firstHoverDone = false;
            
            // Disable hover states during transition
            if (suggestionsList) {
                suggestionsList.classList.add('transitioning');
                
                // Remove transitioning class and enable first-hover after transition completes (0.42s)
                setTimeout(() => {
                    suggestionsList.classList.remove('transitioning');
                    suggestionsList.classList.add('first-hover-fade');
                }, 420);
            }
        });
        
        searchInput.addEventListener('blur', () => {
            // Remove focused class
            searchContainer.classList.remove('focused');
            firstHoverDone = false;
            
            // Disable hover states during transition
            if (suggestionsList) {
                suggestionsList.classList.add('transitioning');
                suggestionsList.classList.remove('first-hover-fade');
                
                // Remove transitioning class after transition completes (0.25s)
                setTimeout(() => {
                    suggestionsList.classList.remove('transitioning');
                }, 250);
            }
        });
        
        // Track first hover
        suggestionItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                if (!firstHoverDone && suggestionsList.classList.contains('first-hover-fade')) {
                    firstHoverDone = true;
                    suggestionsList.classList.remove('first-hover-fade');
                }
            }, { once: false });
        });
    }
    
    // Handle Escape key to deselect search input
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && searchInput && document.activeElement === searchInput) {
            searchInput.blur();
        }
    });
    
    // Maintain focus state when switching apps
    let wasFocusedBeforeBlur = false;
    let isRestoringFocus = false;
    
    if (searchInput && searchContainer) {
        searchInput.addEventListener('focus', () => {
            console.log('[FOCUS] Search input focused, isRestoring:', isRestoringFocus);
            console.log('[FOCUS] Suggestions panel will show');
            
            if (isRestoringFocus) {
                console.log('[FOCUS] This is a restore focus - keeping transitions suppressed');
                // Don't add focused class, it's already there
                isRestoringFocus = false;
            }
            
            // Start gradient animation (unless reduced motion is enabled)
            if (!gradientAnimationId && !document.body.classList.contains('reduced-motion')) {
                animateGradient();
            }
        });
        
        searchInput.addEventListener('blur', () => {
            console.log('[BLUR] Search input blurred');
            console.log('[BLUR] Suggestions panel will hide');
            wasFocusedBeforeBlur = searchContainer.classList.contains('focused');
            console.log('[BLUR] Was in focused state:', wasFocusedBeforeBlur);
            
            // Stop gradient animation
            if (gradientAnimationId) {
                cancelAnimationFrame(gradientAnimationId);
                gradientAnimationId = null;
            }
            const existingStyle = document.getElementById('gradient-animation-style');
            if (existingStyle) {
                existingStyle.remove();
            }
        });
        
        window.addEventListener('blur', () => {
            console.log('[WINDOW BLUR] Window lost focus');
            if (document.activeElement === searchInput) {
                wasFocusedBeforeBlur = true;
                console.log('[WINDOW BLUR] Search was focused, remembering state');
            }
        });
        
        window.addEventListener('focus', () => {
            console.log('[WINDOW FOCUS] Window gained focus, was focused before?', wasFocusedBeforeBlur);
            
            if (wasFocusedBeforeBlur) {
                console.log('[WINDOW FOCUS] Suppressing transitions and restoring focus');
                isRestoringFocus = true;
                
                // Suppress transitions
                searchContainer.style.transition = 'none';
                if (suggestionsList) suggestionsList.style.transition = 'none';
                const logo = document.querySelector('.firefox-logo');
                if (logo) logo.style.transition = 'none';
                
                // Restore focus
                searchInput.focus();
                
                // Re-enable transitions after state is restored
                setTimeout(() => {
                    console.log('[WINDOW FOCUS] Re-enabling transitions');
                    searchContainer.style.transition = '';
                    if (suggestionsList) suggestionsList.style.transition = '';
                    if (logo) logo.style.transition = '';
                }, 100);
                
                wasFocusedBeforeBlur = false;
            }
        });
    }
});
