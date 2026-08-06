//#region node_modules/.nitro/vite/services/ssr/index.js
var serverEntryPromise;
async function getServerEntry() {
	if (!serverEntryPromise) serverEntryPromise = import("./server-YFXObVah.mjs").then((m) => m.default ?? m);
	return serverEntryPromise;
}
function buildSecurityHeaders() {
	return {
		"Content-Security-Policy": [
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline'",
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"img-src 'self' data: blob: https:",
			"font-src 'self' data: https://fonts.gstatic.com",
			"connect-src 'self' https://*.supabase.co wss://*.supabase.co",
			"frame-ancestors 'self'",
			"base-uri 'self'",
			"form-action 'self'",
			"object-src 'none'"
		].join("; "),
		"X-Frame-Options": "SAMEORIGIN",
		"X-Content-Type-Options": "nosniff",
		"Referrer-Policy": "strict-origin-when-cross-origin",
		"Permissions-Policy": "camera=(), microphone=(), geolocation=()",
		"Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
	};
}
function withSecurityHeaders(res) {
	const headers = new Headers(res.headers);
	for (const [k, v] of Object.entries(buildSecurityHeaders())) headers.set(k, v);
	return new Response(res.body, {
		status: res.status,
		statusText: res.statusText,
		headers
	});
}
async function healthCheck() {
	let db = false;
	try {
		const base = "https://zkaeourngxwykkhapotj.supabase.co";
		const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprYWVvdXJuZ3h3eWtraGFwb3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNjg4MDEsImV4cCI6MjEwMDc0NDgwMX0.73H3JRqvojytktdNdI1T7w13Pg7f5mcEClNw8daQnCs";
		db = (await fetch(`${base}/rest/v1/forms?select=id&limit=1`, {
			headers: {
				apikey: key,
				Authorization: `Bearer ${key}`
			},
			signal: AbortSignal.timeout(5e3)
		})).ok;
	} catch {
		db = false;
	}
	return new Response(JSON.stringify({
		ok: true,
		db,
		ts: (/* @__PURE__ */ new Date()).toISOString()
	}), {
		status: db ? 200 : 503,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "no-store"
		}
	});
}
var server_default = { async fetch(request, env, ctx) {
	try {
		if (new URL(request.url).pathname === "/health") return withSecurityHeaders(await healthCheck());
		const res = await (await getServerEntry()).fetch(request, env, ctx);
		if (res.status >= 500) try {
			const bodyText = await res.clone().text();
			console.error("[Server 500 Response]", {
				url: request.url,
				status: res.status,
				body: bodyText
			});
		} catch {}
		return withSecurityHeaders(res);
	} catch (error) {
		console.error("[Server Exception Error]", {
			url: request.url,
			method: request.method,
			error: error instanceof Error ? {
				message: error.message,
				stack: error.stack,
				name: error.name
			} : String(error)
		});
		return withSecurityHeaders(new Response("Internal Server Error", { status: 500 }));
	}
} };
//#endregion
export { server_default as default };
