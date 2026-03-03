// Step 1 JavaScript

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.querySelector('.search-input');
    const searchContainer = document.querySelector('.search-container');
    const firefoxLogo = document.querySelector('.firefox-logo');
    const searchBoxWrapper = document.querySelector('.search-box-wrapper');
    const searchBoxWrapperOuter = document.querySelector('.search-box-wrapper-outer');
    const reducedMotionCheckbox = document.querySelector('.reduced-motion-checkbox');
    
    // Handle reduced motion checkbox
    if (reducedMotionCheckbox) {
        // Load saved state from localStorage
        const savedReducedMotion = localStorage.getItem('reduced_motion_enabled');
        if (savedReducedMotion === 'true') {
            reducedMotionCheckbox.checked = true;
            document.body.classList.add('reduced-motion');
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
        if (searchBoxWrapper && searchBoxWrapperOuter) {
            const wrapperHeight = searchBoxWrapper.offsetHeight;
            const borderRadius = wrapperHeight / 2;
            
            searchBoxWrapper.style.borderRadius = `${borderRadius}px`;
            searchBoxWrapperOuter.style.borderRadius = `${borderRadius}px`;
        }
    };
    
    // Set initial border radius
    updateBorderRadius();
    
    // Update on window resize
    window.addEventListener('resize', updateBorderRadius);
    
    const suggestionsList = document.querySelector('.suggestions-list');
    const suggestionItems = document.querySelectorAll('.suggestion-item');
    let firstHoverDone = false;
    
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
});
