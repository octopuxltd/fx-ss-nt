# Step 1 - Typing Behavior Migration Plan

Migration of search-as-you-type functionality from after-ut.html to step1.html

## Overview

The after-ut.html page has sophisticated AI-powered search suggestions that update as you type. This document outlines what needs to be migrated to step1.html.

---

## Section 1: Core Infrastructure

### 1.1 API Configuration
**Location:** Lines 1654-1669 in after-ut.html

**What it does:**
- Configures multiple AI providers (OpenRouter, Claude, OpenAI)
- Loads API keys from config.js
- Allows switching between providers via localStorage

**Migration tasks:**
- [ ] Copy API configuration variables
- [ ] Import config.js in step1.html
- [ ] Set up provider selection (or hardcode to one provider)

### 1.2 Caching System
**Location:** Lines 1678-1753 in after-ut.html

**What it does:**
- Caches AI suggestions in localStorage (24-hour expiry)
- Caches Firefox suggestions separately
- Filters cached results to only word-start matches
- Prevents duplicate API calls

**Migration tasks:**
- [ ] Implement getCacheKey() function
- [ ] Implement getCachedSuggestions() function
- [ ] Implement cacheSuggestions() function
- [ ] Implement getCachedFirefoxSuggestions() function
- [ ] Implement cacheFirefoxSuggestions() function

---

## Section 2: AI Suggestion Generation

### 2.1 Search Suggestions API
**Location:** Lines 1819-2075 in after-ut.html

**What it does:**
- Makes requests to AI providers (OpenAI, Claude, or OpenRouter)
- Uses specific prompts to generate 10 popular search queries
- Races multiple providers for fastest response
- Handles retries on failure
- Validates and parses JSON responses

**Migration tasks:**
- [ ] Implement makeSearchSuggestionsRequest() function
- [ ] Implement raceProviders() function
- [ ] Implement fetchSearchSuggestions() function
- [ ] Add system/user prompts for search generation
- [ ] Handle API errors and retries

### 2.2 Firefox Suggestions API
**Location:** Lines 2076-2286 in after-ut.html

**What it does:**
- Generates simulated browser history suggestions
- Creates realistic page titles, URLs, descriptions
- Ensures different domains for each suggestion
- 60-character meta descriptions

**Migration tasks:**
- [ ] Implement makeFirefoxSuggestionsRequest() function
- [ ] Implement fetchFirefoxSuggestions() function
- [ ] Add Firefox suggestion prompts
- [ ] Handle Firefox suggestion validation

### 2.3 Main Fetch Function
**Location:** Lines 2288-2490 in after-ut.html

**What it does:**
- Orchestrates both search and Firefox suggestion fetches
- Checks cache first before API calls
- Runs both requests concurrently
- Merges cached + AI results
- Replaces last N suggestions with Firefox suggestions
- Returns combined array with _firefoxSuggestions metadata

**Migration tasks:**
- [ ] Implement fetchAISuggestions() function
- [ ] Merge search + Firefox results logic
- [ ] Add _firefoxSuggestions metadata handling

---

## Section 3: Suggestion Processing

### 3.1 Local Suggestions (1-2 characters)
**Location:** Lines 8661-8697 in after-ut.html

**What it does:**
- For 1 character: finds all 2-char keys starting with that character
- For 2 characters: uses exact match from suggestionWords object
- Provides instant suggestions without API call

**Migration tasks:**
- [ ] Import or recreate suggestion-words.js data
- [ ] Implement 1-character lookup logic
- [ ] Implement 2-character exact match logic

### 3.2 Filtering Existing Suggestions (3+ characters)
**Location:** Lines 4759-4968, 8710-8759 in after-ut.html

**What it does:**
- When user types 3rd+ character, filters existing displayed suggestions
- Shows skeleton loaders while waiting for AI
- Falls back to suggestionWords if no existing suggestions
- Preserves suggestion order for stable UI

**Migration tasks:**
- [ ] Implement filterExistingSuggestions() function
- [ ] Add skeleton loader system
- [ ] Implement showSkeletonLoaders() function
- [ ] Implement removeSkeletons() function

### 3.3 Highlighting Matching Text
**Location:** Lines 4716-4757 in after-ut.html

**What it does:**
- Highlights matching characters in suggestions
- Supports word-start matching
- Bolds the matching portion

**Migration tasks:**
- [ ] Implement highlightMatchingText() function
- [ ] Apply highlighting to suggestion labels

---

## Section 4: Suggestion Display & Updating

### 4.1 Update Suggestions Function
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
- [ ] Implement updateSuggestions() function
- [ ] Add suggestion icon assignment logic
- [ ] Implement typed-text-first logic
- [ ] Add Firefox Suggest rendering
- [ ] Attach hover/click handlers

### 4.2 Icon Assignment
**Location:** Within updateSuggestions (lines ~5200-5300)

**What it does:**
- Lightning icon: AI-generated suggestions
- Clock icon: History suggestions
- Search icon: Other suggestions
- Gmail icon: Gmail shortcut

**Migration tasks:**
- [ ] Track AI suggestions in Set
- [ ] Check search history for icon assignment
- [ ] Implement icon selection logic

---

## Section 5: Input Event Handler

### 5.1 Main Input Handler
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
- [ ] Implement input event listener
- [ ] Add query length branching logic
- [ ] Integrate with all suggestion sources
- [ ] Handle empty field restoration

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

### 6.2 Search History
**What it does:**
- Stores searches in localStorage
- Used for icon assignment (clock icon)
- Affects suggestion sorting

**Migration tasks:**
- [ ] Implement saveToSearchHistory() function
- [ ] Implement isInSearchHistory() function
- [ ] Integrate with icon assignment

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

### Phase 1 (Core)
1. API configuration setup
2. Basic input event handler
3. Local suggestions (1-2 char lookup)
4. Update suggestions function (simplified)

### Phase 2 (AI Integration)
5. Caching system
6. AI API calls for search suggestions
7. Skeleton loaders
8. Filtering existing suggestions

### Phase 3 (Polish)
9. Firefox suggestions (optional)
10. Highlighting matching text
11. Icon assignment logic
12. Search history tracking

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
