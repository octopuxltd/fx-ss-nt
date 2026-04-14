/**
 * One threshold for:
 * - Yellow “BROWSER PROTOTYPE” strip + help (step1.html): show when inner/outer height gap is *greater* than this.
 * - Tab-strip chromeless UI (step1.js): show when gap is *less than or equal* to this.
 */
(function (w) {
    var VIEWPORT_CHROME_HEIGHT_GAP_THRESHOLD_PX = 35;

    function getViewportChromeHeightGapPx() {
        try {
            return Math.abs(w.innerHeight - w.outerHeight);
        } catch (e) {
            return 0;
        }
    }

    w.__VIEWPORT_CHROME_HEIGHT_GAP_THRESHOLD_PX = VIEWPORT_CHROME_HEIGHT_GAP_THRESHOLD_PX;
    w.__getViewportChromeHeightGapPx = getViewportChromeHeightGapPx;
    w.__isViewportChromeIndicatorStripVisible = function () {
        return getViewportChromeHeightGapPx() > VIEWPORT_CHROME_HEIGHT_GAP_THRESHOLD_PX;
    };
    w.__isViewportChromelessPrototypeUi = function () {
        return getViewportChromeHeightGapPx() <= VIEWPORT_CHROME_HEIGHT_GAP_THRESHOLD_PX;
    };
})(typeof globalThis !== 'undefined' ? globalThis : window);
