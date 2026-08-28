# Browser Verification Notes

## Public Guest Quick Analysis

On 2026-08-27, the public landing page was opened in the live preview and a guest review was submitted. The page displayed a completed result card containing the semantic sentiment badge, urgency badge, aspect, confidence, raw JavaScript VADER polarity, Hugging Face refinement state, and final hybrid classification. The page also retained its read-only guest-storage notice.

## Light Theme

The persisted theme preference was switched to light in the live browser and the landing page reloaded with a light canvas, high-contrast dark text, white panels, visible borders, and readable action and semantic-badge colors. The guest trial card, input, empty-result surface, and integrity notice remained legible.

## Protected Route

Opening the live `/dashboard?chat=1` route without an authenticated browser session immediately redirected to the SentiX sign-in page, rather than exposing dashboard or chat content. The authenticated dashboard and chat shell remain covered by their dedicated rendered route test and managed-preview inspection.

## Authenticated Light-Mode Surfaces

The managed authenticated preview was opened at `/dashboard?theme=light` and `/dashboard?chat=1&theme=light`. The dashboard retained readable text, visible grid and card boundaries, blue actions, green positive metrics, red negative metrics, and the fixed Ask SentiX AI entry. The light-mode chat canvas retained visible panel dividers, readable workbench controls, and distinguishable positive and negative KPI values.

Direct browser navigation to those protected URLs correctly redirected to the sign-in page because no authenticated browser session was available. Therefore, the authenticated light-mode visual check is recorded as a managed-preview verification. Interactive browser sign-in was intentionally skipped under the revised access-validation scope.

The existing My Browser connector was enabled with user approval, but the active protected-page browser still reached the SentiX sign-in screen. The landing page now sends explicit `signIn` and `signUp` modes to the existing hosted account service. Its basic email, social, and passkey entry screen is provider-managed; no account creation or sign-in was completed during this verification by user direction.

The public landing was rechecked in both dark and light modes after this account-entry change. In each mode, the Sign In and Sign Up controls, guest analysis card, feature grid, data-integrity section, and footer remained readable with visible action affordances and borders.

## Navigation and Account-Entry Recheck

At the active preview URL, `/login?mode=signup` remained on the real Create Account form with name, email, password, and Create account controls; it did not jump to the dashboard before submission. Opening `/dashboard` without a session redirected to `/login?mode=signin`, showing the local Sign In form and the optional hosted-account continuity action. This confirms the route guard and account-entry separation without simulating a successful login.

The authenticated shell now defines Home as the first navigator, followed by Workbenches and Quick Analysis. Desktop retains the fixed sidebar; mobile uses a real overlay drawer with open, close, Escape, body-scroll locking, and route-link close behavior. Rendered tests cover the drawer and both account recovery modes.

## Post-Drawer Alias Route Verification

After the navigation update, direct preview navigation to `/workbenches` and `/quick-analysis` both reached the local `/login?mode=signin` screen when no session was present, confirming that both aliases remain registered and protected rather than falling through to an unknown route. The local Sign In form remained visible with its real email/password submit action. Authenticated rendered coverage separately confirms both aliases load the real dashboard sections and Home-first navigation.
