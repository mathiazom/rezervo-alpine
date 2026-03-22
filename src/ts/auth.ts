import type { AppConfig } from "./config";

// Access token lives in memory only — never written to any storage
let accessToken: string | null = null;

export function clearToken(): void {
	accessToken = null;
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function base64urlEncode(buffer: ArrayBuffer): string {
	return btoa(String.fromCharCode(...new Uint8Array(buffer)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
}

function generateRandomBase64url(byteLength: number): string {
	const arr = new Uint8Array(byteLength);
	crypto.getRandomValues(arr);
	return base64urlEncode(arr.buffer);
}

async function codeChallenge(verifier: string): Promise<string> {
	const data = new TextEncoder().encode(verifier);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return base64urlEncode(digest);
}

// ── Full PKCE login ───────────────────────────────────────────────────────────

export async function startPkceFlow(config: AppConfig): Promise<void> {
	const verifier = generateRandomBase64url(32);
	const state = generateRandomBase64url(16);
	const challenge = await codeChallenge(verifier);

	sessionStorage.setItem("pkce_verifier", verifier);
	sessionStorage.setItem("pkce_state", state);

	const params = new URLSearchParams({
		response_type: "code",
		client_id: config.fusionAuthClientId,
		redirect_uri: `${config.appUrl}/callback`,
		scope: "openid offline_access",
		state,
		code_challenge: challenge,
		code_challenge_method: "S256",
	});

	window.location.href = `${config.fusionAuthUrl}/oauth2/authorize?${params}`;
}

// ── Callback: send code to auth proxy, which sets httpOnly refresh token cookie ──

export async function handleCallback(): Promise<string> {
	const params = new URLSearchParams(window.location.search);
	const code = params.get("code");
	const state = params.get("state");
	const error = params.get("error");

	if (error) throw new Error(`OAuth error: ${error}`);
	if (!code || !state) throw new Error("Missing code or state in callback");

	const storedState = sessionStorage.getItem("pkce_state");
	const codeVerifier = sessionStorage.getItem("pkce_verifier");

	if (state !== storedState) throw new Error("State mismatch");
	if (!codeVerifier) throw new Error("Missing PKCE verifier");

	sessionStorage.removeItem("pkce_state");
	sessionStorage.removeItem("pkce_verifier");

	const res = await fetch("/auth/token", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ code, codeVerifier }),
	});

	if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
	const json = await res.json();
	const token: string = json.access_token;
	if (!token) throw new Error("No access_token in response");

	accessToken = token;
	return token;
}

// ── Refresh access token via auth proxy (reads httpOnly cookie) ───────────────

// Returns the token or null — never redirects. Use on pages that handle the
// unauthenticated state themselves (e.g. the login page).
export async function tryRefresh(): Promise<string | null> {
	if (accessToken) return accessToken;
	const res = await fetch("/auth/refresh", { method: "POST" });
	if (!res.ok) return null;
	const json = await res.json();
	accessToken = json.access_token as string;
	return accessToken;
}

// Returns the token or redirects to /login. Use on protected pages.
export async function requireAuth(): Promise<string> {
	const token = await tryRefresh();
	if (token) return token;
	window.location.href = "/login";
	return new Promise(() => {});
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
	accessToken = null;
	await fetch("/auth/logout", { method: "POST" }).catch(() => {});
	window.location.href = "/login";
}
