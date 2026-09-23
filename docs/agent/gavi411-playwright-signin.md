# Driving Clerk sign-in with Playwright (Gavi411)

How to automate a real sign-in to this app with a standalone Node +
Playwright script, using the second-party test account. Written after
multiple sessions (this one included, twice in one session) wasted time
misdiagnosing a bad selector as a real Clerk blocker. See
`gavi411-brain.md` decision #145 for the incident.

## The mistake to not repeat

**Never guess a selector from what the flow "should" look like and then
report a timeout as "Clerk can't be automated" or "this hit anti-bot
protection."** Both real failures in this project's history were a wrong
selector matching the wrong element — not a real obstacle. Inspect the
actual rendered DOM before writing a driver:

```js
const inputs = await page.$$eval('input', (els) =>
  els.map((e) => ({ name: e.name, type: e.type, id: e.id }))
)
console.log(inputs)
await page.screenshot({ path: '/tmp/debug.png' })
```

A 30-second look at real output beats a confident wrong guess every time.

## Credentials

Three env vars in the repo's root `.env` (never commit these, never print
them in full):

```
CLERK_TEST_EMAIL       # a real +clerk_test address — Clerk dev-mode
                        # accepts a fixed OTP for these instead of a real
                        # email delivery
CLERK_TEST_PASSWORD
CLERK_TEST_OTP         # the fixed 6-digit code for the above
```

## The working flow

Sign-in is: email → Continue → password → Continue → 6-box one-time-code
screen ("Check your email") → app loads. Skip the "Continue with Google"
button entirely — it's a real, separate OAuth path this account does NOT
use, but it sits right next to the real Continue button and is easy to
mis-click with a loose selector.

### 1. Wait for Clerk to actually mount

The page shows a plain "Loading…" state before Clerk's own sign-in form
renders. Don't act on the DOM until it's gone:

```js
await page.goto('http://localhost:5173')
await page.waitForSelector('#identifier-field', { timeout: 15000 })
```

### 2. Email step

```js
await page.fill('#identifier-field', EMAIL)
await page.getByRole('button', { name: 'Continue', exact: true }).click()
await page.waitForTimeout(1500)
```

**Why `getByRole` with `exact: true`, not `button:has-text("Continue")`**:
a loose text match also matches "Continue with Google". A
`form button[type="submit"]` selector is just as wrong in the other
direction — Clerk renders a hidden `aria-hidden="true"` decoy submit
button for keyboard support that this selector resolves to, then Playwright
times out waiting for it to become visible. Scope by the exact visible
button's accessible name instead.

### 3. Password step (if shown)

```js
const pwField = page.locator('#password-field, input[type="password"]').first()
if (await pwField.isVisible().catch(() => false)) {
  await pwField.fill(PASSWORD)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.waitForTimeout(1500)
}
```

### 4. OTP step ("Check your email")

This renders as 6 separate single-character `<input>` boxes that
auto-advance focus on a real keystroke. **`.fill()` on the first box does
NOT trigger that auto-advance** — the rest of the code silently never
lands. Type it as real sequential keystrokes instead:

```js
const otpInputs = page.locator('input[autocomplete="one-time-code"], input[maxlength="1"]')
if (await otpInputs.count() > 0) {
  await otpInputs.first().click()
  await page.keyboard.type(OTP, { delay: 100 })
  await page.waitForTimeout(2000)
}
```

### 5. Wait for the app to actually load

Same "Loading…" gate as step 1, now for the app shell itself:

```js
await page.waitForFunction(
  () => !document.body.innerText.includes('Loading'),
  { timeout: 15000 }
).catch(() => {})
await page.waitForTimeout(1500)
```

## Complete script skeleton

```js
import { chromium } from 'playwright'

const EMAIL = process.env.CLERK_TEST_EMAIL
const PASSWORD = process.env.CLERK_TEST_PASSWORD
const OTP = process.env.CLERK_TEST_OTP

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1024, height: 800 } })

await page.goto('http://localhost:5173')
await page.waitForSelector('#identifier-field', { timeout: 15000 })
await page.fill('#identifier-field', EMAIL)
await page.getByRole('button', { name: 'Continue', exact: true }).click()
await page.waitForTimeout(1500)

const pwField = page.locator('#password-field, input[type="password"]').first()
if (await pwField.isVisible().catch(() => false)) {
  await pwField.fill(PASSWORD)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.waitForTimeout(1500)
}

const otpInputs = page.locator('input[autocomplete="one-time-code"], input[maxlength="1"]')
if (await otpInputs.count() > 0) {
  await otpInputs.first().click()
  await page.keyboard.type(OTP, { delay: 100 })
  await page.waitForTimeout(2000)
}

await page.waitForFunction(
  () => !document.body.innerText.includes('Loading'),
  { timeout: 15000 }
).catch(() => {})
await page.waitForTimeout(1500)

// ...now signed in, drive the actual test...

await browser.close()
```

## Running it

`playwright` resolves from the repo's own `node_modules` — run from the
repo root, not a subdirectory:

```bash
CLERK_TEST_EMAIL=$(grep -E "^CLERK_TEST_EMAIL=" .env | cut -d= -f2-) \
CLERK_TEST_PASSWORD=$(grep -E "^CLERK_TEST_PASSWORD=" .env | cut -d= -f2-) \
CLERK_TEST_OTP=$(grep -E "^CLERK_TEST_OTP=" .env | cut -d= -f2-) \
node verify-something.mjs
```

Delete the script when done — it's a throwaway verification tool, not
part of the app.

## Getting from the signed-in home screen to a real request

Open requests live behind the hamburger menu (G411-108/WP3 moved them
there), not a home-screen button:

```js
await page.getByRole('button', { name: 'Menu' }).click()
await page.waitForTimeout(500)
await page.locator('.hamburger-menu-item').filter({ hasText: 'Open requests' }).click()
await page.waitForTimeout(1000)
await page.locator('.request-card-button').first().click({ timeout: 5000 })
```

The message compose textarea is `textarea[aria-label="Message"]`.

## Dev server

Assumes Vite is already running at `localhost:5173` (and the API at
`:3000`, if the flow touches server-backed data). Check
`ss -tlnp | grep -E ':(3000|5173)'` before starting a new one — see
[[gavi411-stray-dev-server-processes]] in memory. If server code changed
since the API was last started, restart it (`lsof -ti:3000 -sTCP:LISTEN
| xargs -r kill`, then `npm run dev`) so it picks up the new route/Prisma
client.
