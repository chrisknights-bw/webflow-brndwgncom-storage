const textEncoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
	// Cloudflare Workers supports btoa; Astro CF adapter runs on Workers.
	let binary = "";
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(b64url: string): Uint8Array {
	const pad = b64url.length % 4 === 0 ? "" : "=".repeat(4 - (b64url.length % 4));
	const b64 = b64url.replaceAll("-", "+").replaceAll("_", "/") + pad;
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let out = 0;
	for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
	return out === 0;
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		"raw",
		textEncoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	);
	const sig = await crypto.subtle.sign("HMAC", key, textEncoder.encode(data));
	return new Uint8Array(sig);
}

export type AuthConfig = {
	username: string;
	password: string;
	secret: string;
	basePath: string;
	cookieName: string;
	sessionTtlSeconds: number;
};

export function getAuthConfig(env: Record<string, any> | undefined): AuthConfig {
	const basePath = (env?.ASSETS_PREFIX || "/app") as string;
	return {
		username: (env?.AUTH_USERNAME || "") as string,
		password: (env?.AUTH_PASSWORD || "") as string,
		secret: (env?.AUTH_SECRET || "") as string,
		basePath,
		cookieName: "brndwgn_auth",
		sessionTtlSeconds: 60 * 60 * 24 * 7, // 7 days
	};
}

export function buildLoginRedirect(basePath: string, nextPathAndQuery: string): string {
	const nextParam = encodeURIComponent(nextPathAndQuery);
	return `${basePath.replace(/\/$/, "")}/login?next=${nextParam}`;
}

export async function mintSessionCookieValue(config: AuthConfig): Promise<string> {
	const exp = Math.floor(Date.now() / 1000) + config.sessionTtlSeconds;
	const payload = JSON.stringify({ exp });
	const payloadB64 = toBase64Url(textEncoder.encode(payload));
	const sig = await hmacSha256(config.secret, payloadB64);
	const sigB64 = toBase64Url(sig);
	return `${payloadB64}.${sigB64}`;
}

export async function isAuthed(request: Request, config: AuthConfig): Promise<boolean> {
	if (!config.username || !config.password || !config.secret) return false;

	const cookieHeader = request.headers.get("cookie") || "";
	const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${config.cookieName}=([^;]+)`));
	if (!match) return false;

	const value = match[1];
	const parts = value.split(".");
	if (parts.length !== 2) return false;

	const [payloadB64, sigB64] = parts;
	const expectedSig = await hmacSha256(config.secret, payloadB64);
	const actualSig = fromBase64Url(sigB64);
	if (!timingSafeEqual(expectedSig, actualSig)) return false;

	try {
		const payloadBytes = fromBase64Url(payloadB64);
		const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as { exp?: number };
		if (!payload.exp || typeof payload.exp !== "number") return false;
		return Math.floor(Date.now() / 1000) < payload.exp;
	} catch {
		return false;
	}
}

export function constantTimeStringEquals(a: string, b: string): boolean {
	const aBytes = textEncoder.encode(a);
	const bBytes = textEncoder.encode(b);
	return timingSafeEqual(aBytes, bBytes);
}

export function makeSetCookieHeader(config: AuthConfig, value: string, requestUrl: string): string {
	const url = new URL(requestUrl);
	const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
	// Prefer secure cookies when served over https and not localhost.
	const secure = url.protocol === "https:" && !isLocalhost;

	const attrs = [
		`${config.cookieName}=${value}`,
		`Path=${config.basePath}`,
		"HttpOnly",
		"SameSite=Strict",
		secure ? "Secure" : "",
		`Max-Age=${config.sessionTtlSeconds}`,
	].filter(Boolean);

	return attrs.join("; ");
}

export function makeClearCookieHeader(config: AuthConfig): string {
	const attrs = [
		`${config.cookieName}=`,
		`Path=${config.basePath}`,
		"HttpOnly",
		"SameSite=Strict",
		"Max-Age=0",
	];
	return attrs.join("; ");
}
