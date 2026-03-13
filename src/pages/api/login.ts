import type { APIRoute } from "astro";
import {
	constantTimeStringEquals,
	getAuthConfig,
	makeSetCookieHeader,
	mintSessionCookieValue,
} from "../../lib/auth";

export const POST: APIRoute = async ({ request, locals }) => {
	const env = (locals.runtime as any)?.env as Record<string, any> | undefined;
	const config = getAuthConfig(env);

	if (!config.username || !config.password || !config.secret) {
		return new Response("Auth not configured", { status: 500 });
	}

	const form = await request.formData();
	const username = String(form.get("username") || "");
	const password = String(form.get("password") || "");
	const next = String(form.get("next") || `${config.basePath}/`);

	const ok =
		constantTimeStringEquals(username, config.username) &&
		constantTimeStringEquals(password, config.password);

	if (!ok) {
		const location = `${config.basePath.replace(/\/$/, "")}/login?error=1&next=${encodeURIComponent(next)}`;
		return new Response(null, { status: 302, headers: { Location: location } });
	}

	const cookieValue = await mintSessionCookieValue(config);
	const setCookie = makeSetCookieHeader(config, cookieValue, request.url);

	return new Response(null, {
		status: 302,
		headers: {
			"Set-Cookie": setCookie,
			Location: next,
		},
	});
};
