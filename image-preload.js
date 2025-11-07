// ============================================================================
// IMAGE PRELOADER WITH LOCALSTORAGE CACHING
// ============================================================================
//
// Preloads all carrot images, product card images, and article images for the
// current phase to prevent loading delays when content appears.
// Images are cached in localStorage to avoid re-fetching when switching phases.
//
// CACHING STRATEGY:
// -----------------
// - Images are stored in localStorage as base64 data URLs
// - Cache key format: "img_cache_[url_hash]"
// - Cache includes timestamp for potential expiration
// - Cache size is limited (checks before storing)
//
// USAGE:
// ------
// Call preloadCarrotImages(phaseNumber) with the phase number (1-5)
// This should be called early in the page lifecycle, ideally in a <script>
// tag in the <head> or immediately after the body tag.
//
// ============================================================================

/**
 * Image cache manager using localStorage
 */
const imageCache = {
    CACHE_PREFIX: 'img_cache_',
    MAX_CACHE_SIZE: 5 * 1024 * 1024, // 5MB limit
    CACHE_VERSION: '1.0',

    /**
     * Generate a simple hash from URL for cache key
     */
    hashUrl(url) {
        let hash = 0;
        for (let i = 0; i < url.length; i++) {
            const char = url.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    },

    /**
     * Get cache key for a URL
     */
    getCacheKey(url) {
        return this.CACHE_PREFIX + this.hashUrl(url);
    },

    /**
     * Get cached image data URL
     */
    get(url) {
        try {
            const key = this.getCacheKey(url);
            const cached = localStorage.getItem(key);
            if (cached) {
                const data = JSON.parse(cached);
                // Check if cache is still valid (optional: add expiration check here)
                return data.dataUrl;
            }
        } catch (e) {
            console.warn('Error reading from image cache:', e);
        }
        return null;
    },

    /**
     * Store image data URL in cache
     */
    set(url, dataUrl) {
        try {
            const key = this.getCacheKey(url);
            const data = {
                url: url,
                dataUrl: dataUrl,
                timestamp: Date.now(),
                version: this.CACHE_VERSION
            };
            const dataStr = JSON.stringify(data);
            
            // Check cache size before storing
            const currentSize = this.getCacheSize();
            if (currentSize + dataStr.length > this.MAX_CACHE_SIZE) {
                // Try to clean up old entries
                this.cleanup();
                // Check again after cleanup
                if (this.getCacheSize() + dataStr.length > this.MAX_CACHE_SIZE) {
                    console.warn('Image cache full, skipping:', url);
                    return false;
                }
            }

            localStorage.setItem(key, dataStr);
            return true;
        } catch (e) {
            // Handle quota exceeded error
            if (e.name === 'QuotaExceededError') {
                console.warn('localStorage quota exceeded, cleaning cache');
                this.cleanup();
                try {
                    localStorage.setItem(key, JSON.stringify({
                        url: url,
                        dataUrl: dataUrl,
                        timestamp: Date.now(),
                        version: this.CACHE_VERSION
                    }));
                    return true;
                } catch (e2) {
                    console.warn('Failed to store image in cache after cleanup:', e2);
                }
            } else {
                console.warn('Error storing image in cache:', e);
            }
            return false;
        }
    },

    /**
     * Get total size of cache
     */
    getCacheSize() {
        let total = 0;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.CACHE_PREFIX)) {
                    total += localStorage.getItem(key).length;
                }
            }
        } catch (e) {
            console.warn('Error calculating cache size:', e);
        }
        return total;
    },

    /**
     * Clean up old cache entries (removes oldest 25% if needed)
     */
    cleanup() {
        try {
            const entries = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.CACHE_PREFIX)) {
                    const data = JSON.parse(localStorage.getItem(key));
                    entries.push({ key, timestamp: data.timestamp });
                }
            }
            
            // Sort by timestamp (oldest first)
            entries.sort((a, b) => a.timestamp - b.timestamp);
            
            // Remove oldest 25%
            const toRemove = Math.ceil(entries.length * 0.25);
            for (let i = 0; i < toRemove; i++) {
                localStorage.removeItem(entries[i].key);
            }
        } catch (e) {
            console.warn('Error cleaning cache:', e);
        }
    }
};

/**
 * Load an image, checking cache first
 */
function loadImageWithCache(url) {
    return new Promise((resolve, reject) => {
        // Check cache first
        const cached = imageCache.get(url);
        if (cached) {
            // Create image from cached data URL
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => {
                // Cache might be corrupted, remove it and fetch fresh
                try {
                    localStorage.removeItem(imageCache.getCacheKey(url));
                } catch (e) {
                    // Ignore
                }
                reject(new Error('Cached image failed to load'));
            };
            img.src = cached;
            return;
        }

        // Not in cache, fetch from web
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Required for CORS images to convert to base64
        
        img.onload = () => {
            // Convert to base64 and cache
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                // Convert to data URL
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                
                // Store in cache
                imageCache.set(url, dataUrl);
            } catch (e) {
                // If conversion fails (CORS, etc.), just continue without caching
                console.warn('Could not cache image (CORS or other issue):', url);
            }
            
            resolve(img);
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
    });
}

/**
 * Preloads images for a specific phase
 * @param {number} phase - Phase number (1-5)
 */
function preloadCarrotImages(phase) {
    // Define images used by each carrot type
    const carrotImages = {
        local: [
            'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=200&h=200&q=80',
            'https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=200&h=200&q=80'
        ],
        adMarketplace: [
            'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?auto=format&fit=crop&w=28&h=28&q=80'
        ],
        wikipedia: [
            'https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=300&h=400&q=80'
        ]
    };

    // Define images used by product sections
    const productImages = {
        history: [
            'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=600&q=80'
        ],
        bookmarks: [
            'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=600&q=80'
        ],
        openTabs: [
            'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80'
        ],
        articles: [
            'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80'
        ]
    };

    // Determine which carrots are enabled for each phase
    const phaseCarrots = {
        1: [], // Phase 1: No carrots
        2: [], // Phase 2: No carrots
        3: ['local', 'wikipedia', 'adMarketplace'], // Phase 3: Local, Wikipedia, Ad marketplace
        4: ['wikipedia', 'adMarketplace'], // Phase 4: Wikipedia, Ad marketplace (and others without images)
        5: ['wikipedia', 'adMarketplace'] // Phase 5: Wikipedia, Ad marketplace (and others without images)
    };

    // Determine which product sections are used in each phase
    const phaseProducts = {
        1: ['openTabs'], // Phase 1: Only openTabs has images (historyPhase1 and bookmarksPhase1 are text-only)
        2: ['history', 'bookmarks', 'openTabs'], // Phase 2: All product sections with images
        3: ['history', 'bookmarks', 'openTabs'], // Phase 3: All product sections with images
        4: ['history', 'bookmarks', 'openTabs', 'articles'], // Phase 4: All product sections including articles
        5: ['history', 'bookmarks', 'openTabs', 'articles'] // Phase 5: All product sections including articles
    };

    const carrotsToPreload = phaseCarrots[phase] || [];
    const productsToPreload = phaseProducts[phase] || [];
    const imagesToPreload = [];

    // Collect all images for enabled carrots
    carrotsToPreload.forEach(carrotType => {
        if (carrotImages[carrotType]) {
            imagesToPreload.push(...carrotImages[carrotType]);
        }
    });

    // Collect all images for product sections
    productsToPreload.forEach(productType => {
        if (productImages[productType]) {
            imagesToPreload.push(...productImages[productType]);
        }
    });

    // Preload images with caching
    let cachedCount = 0;
    let fetchedCount = 0;
    
    imagesToPreload.forEach(imageUrl => {
        // Check if already cached before loading
        const wasCached = imageCache.get(imageUrl) !== null;
        
        loadImageWithCache(imageUrl)
            .then(() => {
                if (wasCached) {
                    cachedCount++;
                } else {
                    fetchedCount++;
                }
            })
            .catch(() => {
                // Silently fail - image will load when content appears if preload fails
            });
    });

    // Log for debugging (can be removed in production)
    if (imagesToPreload.length > 0) {
        // Use setTimeout to log after images have had a chance to load
        setTimeout(() => {
            console.log(`Preloading ${imagesToPreload.length} image(s) for Phase ${phase} (${cachedCount} from cache, ${fetchedCount} from web)`);
        }, 100);
    }
}

// Auto-execute if phase number is available in global scope
if (typeof window !== 'undefined' && window.currentPhase) {
    preloadCarrotImages(window.currentPhase);
}

