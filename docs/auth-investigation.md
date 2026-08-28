# Authentication Investigation Notes

## Initial Live Handoff Check

On 2026-08-28, the public SentiX landing page loaded successfully at the active preview URL. Selecting **Sign In** generated a hosted account-service URL with the project application ID, the current preview origin as the OAuth callback, a nonce-bearing state value, and `type=signIn`.

The hosted page began loading but did not provide a completed authenticated return session in the available browser environment. This reproduces the fragile external handoff boundary reported by the user; no credentials were entered during diagnosis.

## Implementation Direction

SentiX will retain its existing hosted-session compatibility while adding a first-party email-and-password account path. The local account path will use a password hash, server-issued HTTP-only signed session cookie, and existing user-owned workbench authorization rather than weakening protected routes.

## Local Account-Entry Verification

The first-party `/login?mode=signup` route was opened in the live preview after implementation. It correctly presented the **Create your workspace** view with name, email, and password fields; a Create Account action; a Sign In switch; and a return link to the public landing page. This route now avoids dependence on the external authentication handoff for SentiX account creation and access.

## End-to-End Local Session Check

With user confirmation, a disposable non-personal account was registered through `auth.register`, signed in through `auth.login`, and used to call the protected `workspace.list` procedure with the issued HTTP-only session cookie. Registration and sign-in returned the expected password-backed user, and the protected procedure returned an authenticated empty workspace list rather than an unauthorized error. The disposable account and credential row were then removed; a read-only verification confirmed zero remaining rows for both tables.

The local account table exists in the database and stores only salted password hashes. Existing hosted OAuth continuity remains available through the secondary hosted-account link on the sign-in view.
