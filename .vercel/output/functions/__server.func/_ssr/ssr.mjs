//#region node_modules/.nitro/vite/services/ssr/index.js
var serverEntryPromise;
async function getServerEntry() {
	if (!serverEntryPromise) serverEntryPromise = import("./server-CLEVXmmi.mjs").then((m) => m.default ?? m);
	return serverEntryPromise;
}
var server_default = { async fetch(request, env, ctx) {
	return (await getServerEntry()).fetch(request, env, ctx);
} };
//#endregion
export { server_default as default };
