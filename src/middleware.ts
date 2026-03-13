import { defineMiddleware } from "astro/middleware";
import { buildLoginRedirect, getAuthConfig, isAuthed } from "./lib/auth";

function isPublicPath(pathname: string, basePath: string): boolean {
	const base = basePath.replace(/\/$/, "");

	// Never treat the app root as public; it should always respect auth.
	if (pathname === base || pathname === `${base}/`) return false;

	// Auth pages / endpoints
	if (pathname === `${base}/login`) return true;
	if (pathname === `${base}/api/login`) return true;
	if (pathname === `${base}/api/logout`) return true;

	// Static assets (Astro build output, favicon, robots, etc.)
	if (pathname.startsWith(`${base}/_astro/`)) return true;
	if (pathname.startsWith(`${base}/favicon`)) return true;
	if (pathname.startsWith(`${base}/robots.txt`)) return true;

	// All other routes (including /api/*) require authentication
	return false;
}

export const onRequest = defineMiddleware(async (context, next) => {
	const env = (context.locals.runtime as any)?.env as Record<string, any> | undefined;
	const config = getAuthConfig(env);

	// If auth isn't configured, don't accidentally lock you out in dev.
	if (!config.username || !config.password || !config.secret) {
		return next();
	}

	const { pathname, search } = new URL(context.request.url);

	if (isPublicPath(pathname, config.basePath)) {
		return next();
	}

	if (await isAuthed(context.request, config)) {
		return next();
	}

	const nextPathAndQuery = `${pathname}${search}`;
	const location = buildLoginRedirect(config.basePath, nextPathAndQuery);
	return context.redirect(location, 302);
});
