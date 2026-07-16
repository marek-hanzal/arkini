import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const engineRoot = resolve("src/engine");
const uiRoot = resolve("src/ui");

const readFiles = (directory: string): string[] =>
	readdirSync(directory).flatMap((entry) => {
		const path = join(directory, entry);
		return statSync(path).isDirectory()
			? readFiles(path)
			: [
					path,
				];
	});

const readTypeScriptFiles = (directory: string): string[] =>
	readFiles(directory).filter((path) => /\.(ts|tsx)$/.test(path));

describe("engine/UI source boundary", () => {
	it("keeps React imports out of the standalone engine", () => {
		const offenders = readTypeScriptFiles(engineRoot)
			.filter((path) =>
				/from ["'](?:react|react-dom|@tanstack\/react-router)(?:\/[^"']*)?["']/.test(
					readFileSync(path, "utf8"),
				),
			)
			.map((path) => relative(engineRoot, path));

		expect(offenders).toEqual([]);
	});

	it("keeps the engine independent from UI adapters", () => {
		const offenders = readTypeScriptFiles(engineRoot)
			.filter((path) => /~\/ui\//.test(readFileSync(path, "utf8")))
			.map((path) => relative(engineRoot, path));

		expect(offenders).toEqual([]);
	});

	it("keeps UI adapters out of engine internal modules", () => {
		const offenders = readTypeScriptFiles(uiRoot)
			.filter((path) => /~\/engine\/[^"']*\/internal\//.test(readFileSync(path, "utf8")))
			.map((path) => relative(uiRoot, path));

		expect(offenders).toEqual([]);
	});
});
