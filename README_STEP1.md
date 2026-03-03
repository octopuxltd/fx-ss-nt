# Step 1 - Search Interface Prototype

A clean, animated search interface with Firefox branding.

## Features

- Centered Firefox logo and search box
- Smooth transitions when focusing the search input:
  - Search box expands width by 20%
  - Search box moves up 55px
  - Suggestions panel slides down from behind
  - Firefox logo scales down to 80%
  - Shadow intensifies
- First-hover fade effect on suggestions
- Right arrow search button

## Accessibility

**Reduced Motion Mode**

When the reduce motion checkbox is selected, respect the user's reduce motion preference by not applying transitions.

This checkbox (located in bottom-left corner) disables:
- Search box width expansion
- Upward movement
- Suggestions panel sliding animation
- Firefox logo scaling
- First-hover fade effect
- Background color transition delays

All interactions become instant when reduced motion is enabled.

## Files

- `step1.html` - Main HTML structure
- `step1.css` - Styles and animations
- `step1.js` - Interaction logic
- `icons/chevron-step1.svg` - Custom chevron with stronger stroke
