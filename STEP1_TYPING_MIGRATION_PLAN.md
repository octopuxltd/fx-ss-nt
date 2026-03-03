# Step 1 - Typing Behavior Migration Plan

Migration of search-as-you-type functionality from after-ut.html to step1.html

## Overview

The after-ut.html page has sophisticated AI-powered search suggestions that update as you type. This document outlines what needs to be migrated to step1.html.

---

## Section 1: Core Infrastructure ✅ COMPLETE

### 1.1 API Configuration ✅
**Location:** Lines 1654-1669 in after-ut.html

**What it does:**
- Configures multiple AI providers (OpenRouter, Claude, OpenAI)
- Loads API keys from config.js
- Allows switching between providers via localStorage

**Migration tasks:**
- [x] Copy API configuration variables
- [x] Import config.js in step1.html
- [x] Set up provider selection (or hardcode to one provider)

**Status:** COMPLETE (Commit: 01767f0)

### 1.2 Caching System ✅
**Location:** Lines 1678-1753 in after-ut.html

**What it does:**
- Caches AI suggestions in localStorage (24-hour expiry)
- Caches Firefox suggestions separately
- Filters cached results to only word-start matches
- Prevents duplicate API calls

**Migration tasks:**
- [x] Implement getCacheKey() function
- [x] Implement getCachedSuggestions() function
- [x] Implement cacheSuggestions() function
- [x] Implement getCachedFirefoxSuggestions() function
- [x] Implement cacheFirefoxSuggestions() function

**Status:** COMPLETE (Commit: ae13a59)

---

## Section 2: AI Suggestion Generation ✅ COMPLETE

### 2.1 Search Suggestions API ✅
**Location:** Lines 1819-2075 in after-ut.html

**What it does:**
- Makes requests to AI providers (OpenAI, Claude, or OpenRouter)
- Uses specific prompts to generate 10 popular search queries
- Races multiple providers for fastest response
- Handles retries on failure
- Validates and parses JSON responses

**Migration tasks:**
- [x] Implement makeSearchSuggestionsRequest() function
- [x] Implement raceProviders() function
- [x] Implement fetchSearchSuggestions() function
- [x] Add system/user prompts for search generation
- [x] Handle API errors and retries

**Status:** COMPLETE (Commit: 28c2a4d)

### 2.2 Firefox Suggestions API ✅
**Location:** Lines 2076-2286 in after-ut.html

**What it does:**
- Generates simulated browser history suggestions
- Creates realistic page titles, URLs, descriptions
- Ensures different domains for each suggestion
- 60-character meta descriptions

**Migration tasks:**
- [x] Implement makeFirefoxSuggestionsRequest() function
- [x] Implement fetchFirefoxSuggestions() function
- [x] Add Firefox suggestion prompts
- [x] Handle Firefox suggestion validation

**Status:** COMPLETE (Commit: 1c39f59)

### 2.3 Main Fetch Function ✅
**Location:** Lines 2288-2490 in after-ut.html

**What it does:**
- Orchestrates both search and Firefox suggestion fetches
- Checks cache first before API calls
- Runs both requests concurrently
- Merges cached + AI results
- Replaces last N suggestions with Firefox suggestions
- Returns combined array with _firefoxSuggestions metadata

**Migration tasks:**
- [x] Implement fetchAISuggestions() function
- [x] Merge search + Firefox results logic
- [x] Add _firefoxSuggestions metadata handling

**Status:** COMPLETE (Commit: 62f33ca)

---

## Section 3: Suggestion Processing

### 3.1 Local Suggestions (1-2 characters) ✅
**Location:** Lines 8661-8697 in after-ut.html

**What it does:**
- For 1 character: finds all 2-char keys starting with that character
- For 2 characters: uses exact match from suggestionWords object
- Provides instant suggestions without API call

**Migration tasks:**
- [x] Import or recreate suggestion-words.js data
- [x] Implement 1-character lookup logic
- [x] Implement 2-character exact match logic

**Status:** COMPLETE (Commit: 96478de)

### 3.2 Filtering & Skeleton Loaders ✅
**Location:** Lines 4670-4708, 4759-4968 in after-ut.html

**What it does:**
- Shows placeholder suggestions while waiting for AI
- Random widths (60-160px) for natural look
- Pulse animation
- Removes when real suggestions arrive
- Filters existing suggestions as you continue typing

**Migration tasks:**
- [x] Add skeleton loader system
- [x] Implement showSkeletonLoaders() function
- [x] Implement removeSkeletons() function
- [x] Implement filterExistingSuggestions() function

**Status:** COMPLETE (Commits: 4f8b84a, pending)

### 3.3 Highlighting Matching Text ✅
**Location:** Lines 4716-4757 in after-ut.html

**What it does:**
- Highlights matching characters in suggestions
- Supports word-start matching
- Bolds the matching portion

**Migration tasks:**
- [x] Implement highlightMatchingText() function
- [x] Apply highlighting to suggestion labels

**Status:** COMPLETE (Commit: pending)

---

## Section 4: Suggestion Display & Updating

### 4.1 Update Suggestions Function ✅ COMPLETE
**Location:** Lines 4970-6577 in after-ut.html

**What it does:**
- Removes existing skeletons
- Preserves display order of existing suggestions
- Separates history vs non-history suggestions
- Adds typed text as first suggestion (if not duplicate)
- Assigns icons (lightning/clock/search)
- Handles Firefox Suggest items separately
- Attaches event listeners (hover, click, menu)

**Migration tasks:**
- [x] Implement updateSuggestions() function
- [x] Add suggestion icon assignment logic (basic version)
- [x] Implement typed-text-first logic
- [x] Track AI suggestions for icon assignment
- [x] Attach hover/click handlers

**Status:** COMPLETE (Commits: d83c9d9, 38bc3e9)
**Note:** Basic icon logic implemented (search for AI, clock for others)

### 4.2 Icon Assignment ✅
**Location:** Within updateSuggestions (lines ~5200-5300)

**What it does:**
- Lightning icon: AI-generated suggestions (popular/trending)
- Clock icon: History suggestions
- Search icon: Other AI suggestions
- Gmail icon: Gmail shortcut

**Migration tasks:**
- [x] Track AI suggestions in Set
- [x] Check search history for icon assignment
- [x] Implement icon selection logic
- [x] Add iconMappings for lightning suggestions

**Status:** COMPLETE (Commit: pending)

---

## Section 5: Input Event Handler

### 5.1 Main Input Handler ✅
**Location:** Lines 8545-8940 in after-ut.html

**What it does:**
- Triggers on every keystroke
- Shows/hides clear button
- Handles empty field (shows default suggestions)
- Routes to different handlers based on query length:
  - 0 chars: default suggestions
  - 1-2 chars: local suggestionWords lookup
  - 3+ chars: filter existing OR fetch from AI

**Migration tasks:**
- [x] Implement input event listener
- [x] Add query length branching logic (0 and 3+ chars)
- [x] Integrate with all suggestion sources
- [x] Handle empty field restoration
- [ ] Add 1-2 character local lookup (deferred)

**Status:** COMPLETE - Core functionality (Commit: 54a04b6)
**Note:** 1-2 char local lookup skipped for now

---

## Section 6: Additional Features

### 6.1 Skeleton Loaders
**What it does:**
- Shows placeholder suggestions while AI loads
- Random widths (60-160px) for natural look
- Pulse animation

**Migration tasks:**
- [ ] Create skeleton HTML template
- [ ] Add skeleton CSS animations
- [ ] Implement show/hide skeleton logic

### 6.2 Search History ✅
**What it does:**
- Stores searches in localStorage
- Used for icon assignment (clock icon)
- Affects suggestion sorting

**Migration tasks:**
- [x] Implement saveToSearchHistory() function
- [x] Implement isInSearchHistory() function
- [x] Integrate with icon assignment
- [x] Add click handlers to save searches
- [x] Implement moveToTopOfHistory() function

**Status:** COMPLETE (Commit: pending)

### 6.3 Clear Button
**What it does:**
- Shows X button when text is entered
- Clears search and resets to defaults

**Migration tasks:**
- [ ] Add clear button HTML
- [ ] Implement updateClearButton() function
- [ ] Add clear button click handler

---

## Implementation Priority

### Phase 1 (Core) ✅ COMPLETE
1. ✅ API configuration setup (Section 1.1)
2. ✅ Basic input event handler (Section 5.1)
3. ✅ Local suggestions (1-2 char lookup) (Section 3.1)
4. ✅ Update suggestions function (simplified) (Section 4.1)

### Phase 2 (AI Integration) ✅ COMPLETE
5. ✅ Caching system (Section 1.2)
6. ✅ AI API calls for search suggestions (Section 2.1)
7. ✅ Skeleton loaders (Section 3.2)
8. ⏸️ Filtering existing suggestions - DEFERRED

### Phase 3 (Polish) 🔄 OPTIONAL
9. Firefox suggestions (optional) - API ready (Section 2.2, 2.3), rendering deferred
10. Highlighting matching text - DEFERRED
11. Icon assignment logic - Basic version implemented
12. Search history tracking - DEFERRED

---

## ✅ CURRENT STATUS

**WORKING NOW:**
- Type 1 character → Instant local suggestions!
- Type 2 characters → Instant exact match!
- Type 3+ characters → Skeleton loaders → AI suggestions appear!
- Clear field → Default suggestions restore
- All AI suggestions cached for 24 hours
- Multi-provider support with intelligent retries

**Commits:**
- 01767f0 - Section 1.1 (API Config)
- ae13a59 - Section 1.2 (Caching)
- 28c2a4d - Section 2.1 (Search API)
- 1c39f59 - Section 2.2 (Firefox API)
- 62f33ca - Section 2.3 (Main Fetch)
- 54a04b6 - Section 5.1 (Input Handler)
- d83c9d9 - Section 4.1 (Update Suggestions - Initial)
- 4f8b84a - Section 3.2 (Skeleton Loaders)
- 96478de - Section 3.1 (Local Suggestions)
- 1720ddc - Section 3.3 (Highlighting)
- 5d9f533 - Section 3.2 (Filtering)
- 38bc3e9 - Section 4.1 (Complete)
- Pending - Section 4.2 (Icon Assignment)

---

## Key Differences to Consider

- **Step1 uses modular files** (step1.js) vs inline scripts
- **Simpler UI** - no carrots, preview boxes, or complex layouts
- **May not need Firefox suggestions** - depends on requirements
- **Different styling** - adapt to step1's design system
- **Reduced motion support** - ensure all features respect this

---

## Files Needed

- `step1.js` - Main logic
- `config.js` - API keys (already exists)
- `suggestion-words.js` - Local suggestions data (may need to copy)
- Icons - clock.svg, lightning.svg (already have clock.svg)

---

## Estimated Complexity

- **High complexity:** AI API integration, caching, concurrent requests
- **Medium complexity:** Filtering, skeleton loaders, suggestion updates
- **Low complexity:** Local lookups, highlighting, search history
