//#region node_modules/.nitro/vite/services/ssr/assets/theme-utils-CZ5WP4IV.js
function isLightColor(hex) {
	const m = hex.replace("#", "");
	if (!/^[0-9a-fA-F]{6}$/.test(m)) return false;
	const r = parseInt(m.slice(0, 2), 16) / 255;
	const g = parseInt(m.slice(2, 4), 16) / 255;
	const b = parseInt(m.slice(4, 6), 16) / 255;
	return .2126 * r + .7152 * g + .0722 * b > .55;
}
function rgba(hex, alpha) {
	const m = hex.replace("#", "");
	if (!/^[0-9a-fA-F]{6}$/.test(m)) return `rgba(11, 11, 22, ${alpha})`;
	return `rgba(${parseInt(m.slice(0, 2), 16)}, ${parseInt(m.slice(2, 4), 16)}, ${parseInt(m.slice(4, 6), 16)}, ${alpha})`;
}
function themeContainerStyle(t, bgImageUrl) {
	if (!t) return {};
	const s = {};
	if (t.primary_color) {
		s["--primary"] = t.primary_color;
		s["--ring"] = t.primary_color;
		s["--accent"] = t.primary_color;
		s["--primary-foreground"] = isLightColor(t.primary_color) ? "#0f172a" : "#ffffff";
	}
	if (t.background_color) {
		const light = isLightColor(t.background_color);
		s["--background"] = t.background_color;
		s["--foreground"] = light ? "#0f172a" : "#f8fafc";
		s["--muted-foreground"] = light ? "#475569" : "#94a3b8";
		s["--border"] = light ? "#cbd5e1" : "#334155";
		s["--input"] = light ? "#cbd5e1" : "#334155";
		s["--secondary"] = light ? "#e2e8f0" : "#1e293b";
		s["--secondary-foreground"] = light ? "#0f172a" : "#f8fafc";
	}
	if (t.card_color) {
		s["--card"] = t.card_color;
		s["--card-foreground"] = isLightColor(t.card_color) ? "#0f172a" : "#f8fafc";
	}
	if (t.border_radius) s["--radius"] = t.border_radius;
	const style = s;
	if (t.font_family) style.fontFamily = t.font_family;
	if (bgImageUrl) {
		const safeBgUrl = bgImageUrl.replace(/[)"'\\]/g, (m) => "%" + m.charCodeAt(0).toString(16).padStart(2, "0"));
		const rawOverlay = t.bg_overlay_opacity ?? .6;
		const overlayOpacity = Math.min(.75, Math.max(.4, rawOverlay));
		const overlay = rgba(t.background_color ?? "#0b0b16", overlayOpacity);
		style.backgroundImage = `linear-gradient(${overlay}, ${overlay}), url("${safeBgUrl}")`;
		style.backgroundSize = "cover";
		style.backgroundPosition = "center";
		style.backgroundAttachment = "fixed";
	}
	return style;
}
//#endregion
export { themeContainerStyle as t };
