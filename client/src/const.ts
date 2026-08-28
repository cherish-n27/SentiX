import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export type AccountEntryMode = "signIn" | "signUp";

/** A stable first-party account path that works without a cross-site handoff. */
export const getAccountEntryPath = (mode: AccountEntryMode = "signIn") =>
  `/login?mode=${mode === "signUp" ? "signup" : "signin"}`;

// Start account access only from an event handler or navigation effect.
export const startLogin = (mode: AccountEntryMode = "signIn") => {
  window.location.assign(getAccountEntryPath(mode));
};

/** Optional continuity path for accounts previously created through the hosted provider. */
export const startHostedLogin = (mode: AccountEntryMode = "signIn") => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  const state = encodeOAuthState({ redirectUri, nonce });
  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", mode);
  window.location.assign(url.toString());
};
