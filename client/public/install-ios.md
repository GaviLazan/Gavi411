# Installing Gavi411 on iPhone

iOS Safari doesn't show an automatic "install" prompt like Android/desktop
Chrome does — it has to be done manually via the Share sheet:

1. Open the site in **Safari** (not Chrome/Firefox on iOS — they can't
   install PWAs, only Safari can).
2. Tap the **Share** icon (square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add** in the top-right corner.

The app icon now appears on the home screen and opens without Safari's
address bar (per the `apple-mobile-web-app-capable` tag in `index.html`).

Note: iOS requires the app to be installed this way (not just open in a
Safari tab) before Web Push notifications can work — relevant once G411-49
(push subscribe flow) ships.

---
ponytail: this is a placeholder note, not a real in-app help page/UI —
that's explicitly out of scope for G411-15 ("installability baseline").
Promote to a real help page/component if/when onboarding needs it.
