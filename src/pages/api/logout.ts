import type { APIRoute } from "astro";
import { getAuthConfig, makeClearCookieHeader } from "../../lib/auth";

const handler: APIRoute = async ({ locals }) => {
	const env = (locals.runtime as any)?.env as Record<string, any> | undefined;
	const config = getAuthConfig(env);

	const clearCookie = makeClearCookieHeader(config);
	const location = `${config.basePath.replace(/\/$/, "")}/login`;

	return new Response(null, {
		status: 302,
		headers: {
			"Set-Cookie": clearCookie,
			Location: location,
		},
	});
};

export const POST = handler;
export const GET = handler;

