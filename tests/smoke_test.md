---
mode: testing
headless: true
max_steps: 25
timeout: 90
---

# TravelGit smoke test

Fast, AI-free render/navigation check used by the "verify on change" hook.
Covers homepage → login → dashboard → trip page. No AI actions, so it's
deterministic and cheap to replay from cache on every file change.

## Open the homepage
Open http://localhost:5173/. An intro animation may briefly cover the screen on
first load — if it appears, click anywhere to skip it or wait until it disappears
(about 3 seconds). Then verify the page shows the "TravelGit" wordmark, the
tagline "Your itinerary, version-controlled", and a "Start planning" button.

## Log in as a demo user
Click the "Start planning" button to go to the login page. In the
"Quick login (demo users)" section, click the button with
data-testid "quick-login-aashna". Verify you land on the dashboard and the
heading "Your travel repos" is visible.

## Open a trip and verify it renders
```yaml
optional: true
```
Click the first trip card (data-testid "trip-card"). Verify the trip page
renders correctly: the trip name in the header, an itinerary list
(data-testid "itinerary-list") containing at least a "Day 1" section, and the
inline "Make changes with AI" panel (data-testid "agent-chat") at the bottom.
Do NOT run any AI action (no overview/hotels/flights/chat) — this is a render
check only.
