import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const electronRoot = resolve("electron");
const rendererRoots = [
	resolve("src/engine"),
	resolve("src/bridge"),
	resolve("src/ui"),
	resolve("src/page"),
	resolve("src/@routes"),
];

const readTypeScriptFiles = (directory: string): string[] =>
	readdirSync(directory).flatMap((entry) => {
		const path = join(directory, entry);
		return statSync(path).isDirectory()
			? readTypeScriptFiles(path)
			: /\.(ts|tsx)$/.test(path)
				? [
						path,
					]
				: [];
	});

describe("Electron platform boundary", () => {
	it("keeps Electron and Node platform imports out of renderer domains", () => {
		const offenders = rendererRoots.flatMap((root) =>
			readTypeScriptFiles(root)
				.filter((path) =>
					/from ["'](?:electron|electron\/|~\/\.\.\/electron|\.\.\/.*electron)/.test(
						readFileSync(path, "utf8"),
					),
				)
				.map((path) => relative(resolve("."), path)),
		);

		expect(offenders).toEqual([]);
	});

	it("keeps the Electron platform independent from renderer and engine roots", () => {
		const offenders = readTypeScriptFiles(electronRoot)
			.filter((path) =>
				/~\/(?:engine|bridge|ui|page|@routes)\//.test(readFileSync(path, "utf8")),
			)
			.map((path) => relative(electronRoot, path));

		expect(offenders).toEqual([]);
	});

	it("uses standard router history and the canonical custom origin", () => {
		const routerSource = readFileSync("src/router.tsx", "utf8");
		const mainSource = readFileSync("electron/main/index.ts", "utf8");
		const windowSource = readFileSync("electron/main/createMainWindowFx.ts", "utf8");

		expect(routerSource).not.toContain("createHashHistory");
		expect(mainSource).toContain('scheme: "arkini"');
		expect(mainSource).toContain("standard: true");
		expect(windowSource).toContain('window.loadURL("arkini://app/")');
	});
});
