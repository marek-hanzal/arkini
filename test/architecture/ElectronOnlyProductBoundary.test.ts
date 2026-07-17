import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import packageJson from "../../package.json" with { type: "json" };

const read = (path: string) => readFileSync(path, "utf8");

const readTypeScriptFiles = (directory: string): string[] =>
	readdirSync(directory, {
		withFileTypes: true,
	}).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return readTypeScriptFiles(path);
		return entry.isFile() && /\.(ts|tsx)$/.test(entry.name)
			? [
					path,
				]
			: [];
	});

const rendererProductFiles = [
	...readTypeScriptFiles("src/bridge"),
	...readTypeScriptFiles("src/ui"),
	...readTypeScriptFiles("src/page"),
	...readTypeScriptFiles("src/@routes"),
	"src/main.tsx",
	"src/router.tsx",
];

describe("Electron-only product boundary", () => {
	it("exposes no standalone web scripts or Vite product config", () => {
		const standaloneWebScripts = Object.entries(packageJson.scripts).filter(
			([name, command]) => name.includes("browser") || /(^|\s)vite(?:\s|$)/.test(command),
		);

		expect(standaloneWebScripts).toEqual([]);
		expect(existsSync("vite.config.ts")).toBe(false);
		expect(read("electron.vite.config.ts")).toContain("renderer:");
		expect(read("electron.vite.config.ts")).toContain("tanstackRouter");
	});

	it("requires the preload API and has no runtime memory fallback", () => {
		const desktopApi = read("desktop/ArkiniDesktopApi.ts");
		const productSource = rendererProductFiles.map(read).join("\n");

		expect(desktopApi).toContain("readonly arkini: ArkiniDesktopApi.Api;");
		expect(desktopApi).not.toContain("readonly arkini?:");
		expect(read("src/main.tsx")).toContain("Arkini Electron preload API is unavailable.");
		expect(productSource).not.toContain("window.arkini?.");
		expect(productSource).not.toContain('typeof window === "undefined"');
		expect(productSource).not.toContain("MemoryArkpackStorage");
		expect(productSource).not.toContain("MemoryGameSaveStorage");
		expect(existsSync("src/bridge/arkpack/MemoryArkpackStorage.ts")).toBe(false);
		expect(existsSync("src/bridge/save/MemoryGameSaveStorage.ts")).toBe(false);
	});

	it("keeps in-memory repositories confined to explicit test support", () => {
		expect(existsSync("test/support/arkpack/createInMemoryArkpackStorageFx.ts")).toBe(true);
		expect(existsSync("test/support/save/createInMemoryGameSaveStorageFx.ts")).toBe(true);
		expect(read("test/support/arkpack/createInMemoryArkpackStorageFx.ts")).toContain(
			"tests only",
		);
		expect(read("test/support/save/createInMemoryGameSaveStorageFx.ts")).toContain(
			"tests only",
		);
	});
});
