import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AppearanceThemeSchema } from "../../desktop/appearance/AppearanceThemeSchema";

const read = (path: string) => readFileSync(path, "utf8");
const readSourceFiles = (directory: string): string[] =>
	readdirSync(directory, {
		withFileTypes: true,
	}).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return readSourceFiles(path);
		return entry.isFile() && /\.(ts|tsx)$/.test(entry.name)
			? [
					path,
				]
			: [];
	});

const uiSource = [
	...readSourceFiles("src/ui"),
	...readSourceFiles("src/page"),
	...readSourceFiles("src/@routes"),
]
	.map(read)
	.join("\n");

const rawPaletteUtility =
	/\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to)-(?:slate|zinc|gray|neutral|stone|red|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-|\/|\b)/;

describe("semantic design token boundary", () => {
	it("keeps active UI on semantic colors without palette-specific theme branches", () => {
		expect(uiSource).not.toMatch(rawPaletteUtility);
		expect(uiSource).not.toContain("dark:");
	});

	it("defines the bounded Arkini semantic palette in one theme source", () => {
		const styles = read("src/ui/styles.css");
		for (const token of [
			"canvas",
			"surface",
			"surface-raised",
			"foreground",
			"muted",
			"subtle",
			"line",
			"line-strong",
			"accent",
			"accent-contrast",
			"info",
			"success",
			"warning",
			"danger",
			"overlay",
		]) {
			expect(styles).toContain(`--color-${token}:`);
		}
		expect(styles).toContain("light-dark(");
		expect(styles).toContain(':root[data-theme="system"]');
		expect(styles).toMatch(
			/:root\[data-theme="system"\]\s*\{[^}]*color-scheme:\s*light dark;/s,
		);
	});

	it("defaults to dark while allowing an explicit system preference", () => {
		expect(AppearanceThemeSchema.options).toEqual([
			"dark",
			"light",
			"system",
		]);
		expect(read("index.html")).toContain('data-theme="dark"');
		expect(read("electron/main/appearance/readAppearanceThemeFx.ts")).toContain(
			'return "dark"',
		);
		expect(read("electron/main/electronMainFx.ts")).toContain(
			"nativeTheme.themeSource = appearanceTheme",
		);
		expect(read("src/main.tsx")).toContain(
			"document.documentElement.dataset.theme = initialTheme",
		);
		expect(uiSource).not.toContain("localStorage");
	});
});
