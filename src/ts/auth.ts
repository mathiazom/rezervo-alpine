import type { AppConfig } from "./config";

// Access token lives in memory only — never written to any storage
let accessToken: string | null = null;

export function getToken(): string | null {
	return accessToken;
}

export function setToken(token: string): void {
	accessToken = token;
}

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
		scope: "openid",
		state,
		code_challenge: challenge,
		code_challenge_method: "S256",
	});

	window.location.href = `${config.fusionAuthUrl}/oauth2/authorize?${params}`;
}

export async function handleCallback(config: AppConfig): Promise<string> {
	const params = new URLSearchParams(window.location.search);
	const code = params.get("code");
	const state = params.get("state");
	const error = params.get("error");

	if (error) throw new Error(`OAuth error: ${error}`);
	if (!code || !state) throw new Error("Missing code or state in callback");

	const storedState = sessionStorage.getItem("pkce_state");
	const verifier = sessionStorage.getItem("pkce_verifier");

	if (state !== storedState) throw new Error("State mismatch");
	if (!verifier) throw new Error("Missing PKCE verifier");

	sessionStorage.removeItem("pkce_state");
	sessionStorage.removeItem("pkce_verifier");

	const body = new URLSearchParams({
		grant_type: "authorization_code",
		client_id: config.fusionAuthClientId,
		code,
		redirect_uri: `${config.appUrl}/callback`,
		code_verifier: verifier,
	});

	const res = await fetch(`${config.fusionAuthUrl}/oauth2/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString(),
	});

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		console.error("Token exchange error:", res.status, body);
		throw new Error(`Token exchange failed: ${res.status} — ${body}`);
	}
	const json = await res.json();
	const token: string = json.access_token;
	if (!token) throw new Error("No access_token in response");

	setToken(token);
	return token;
}

// ── Silent renew via hidden iframe ────────────────────────────────────────────

async function silentRenew(config: AppConfig): Promise<string> {
	const verifier = generateRandomBase64url(32);
	const state = generateRandomBase64url(16);
	const challenge = await codeChallenge(verifier);

	// Store for the callback page to pick up (same origin)
	sessionStorage.setItem("pkce_verifier", verifier);
	sessionStorage.setItem("pkce_state", state);

	const params = new URLSearchParams({
		response_type: "code",
		client_id: config.fusionAuthClientId,
		redirect_uri: `${config.appUrl}/callback`,
		scope: "openid",
		state,
		code_challenge: challenge,
		code_challenge_method: "S256",
		prompt: "none",
	});

	const iframe = document.createElement("iframe");
	iframe.style.display = "none";
	iframe.src = `${config.fusionAuthUrl}/oauth2/authorize?${params}`;

	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			cleanup();
			reject(new Error("Silent renew timed out"));
		}, 10_000);

		function onMessage(event: MessageEvent) {
			if (event.origin !== window.location.origin) return;
			if (event.data?.type === "silent-renew-success") {
				cleanup();
				resolve(event.data.token as string);
			} else if (event.data?.type === "silent-renew-failure") {
				cleanup();
				reject(new Error("Silent renew failed: session expired"));
			}
		}

		function cleanup() {
			clearTimeout(timeout);
			window.removeEventListener("message", onMessage);
			if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
		}

		window.addEventListener("message", onMessage);
		document.body.appendChild(iframe);
	});
}

// ── requireAuth ───────────────────────────────────────────────────────────────

export async function requireAuth(config: AppConfig): Promise<string> {
	if (accessToken) return accessToken;

	try {
		const token = await silentRenew(config);
		accessToken = token;
		return token;
	} catch {
		window.location.href = `${config.appUrl}/login`;
		// Never resolves — we're navigating away
		return new Promise(() => {});
	}
}

// ── Logout ────────────────────────────────────────────────────────────────────

export function logout(config: AppConfig): void {
	clearToken();
	window.location.href = `${config.appUrl}/login`;
}
