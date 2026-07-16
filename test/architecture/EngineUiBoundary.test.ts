import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const engineRoot = resolve("src/engine");
const uiRoot = resolve("src/ui");
const pageRoot = resolve("src/page");
const routeRoot = resolve("src/@routes");

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

const readImportedModules = (path: string): string[] =>
	Array.from(readFileSync(path, "utf8").matchAll(/from ["']([^"']+)["']/g), (match) => match[1]);

describe("engine/UI/page/route source boundary", () => {
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

	it("keeps the engine independent from presentation roots", () => {
		const offenders = readTypeScriptFiles(engineRoot)
			.filter((path) => /~\/(?:ui|page|@routes)\//.test(readFileSync(path, "utf8")))
			.map((path) => relative(engineRoot, path));

		expect(offenders).toEqual([]);
	});

	it("keeps UI adapters out of engine internal modules", () => {
		const offenders = readTypeScriptFiles(uiRoot)
			.filter((path) => /~\/engine\/[^"']*\/internal\//.test(readFileSync(path, "utf8")))
			.map((path) => relative(uiRoot, path));

		expect(offenders).toEqual([]);
	});

	it("keeps reusable UI independent from pages and routes", () => {
		const offenders = readTypeScriptFiles(uiRoot)
			.filter((path) => /~\/(?:page|@routes)\//.test(readFileSync(path, "utf8")))
			.map((path) => relative(uiRoot, path));

		expect(offenders).toEqual([]);
	});

	it("keeps pages independent from route registration modules", () => {
		const offenders = readTypeScriptFiles(pageRoot)
			.filter((path) => /~\/(?:@routes\/|_route|router)/.test(readFileSync(path, "utf8")))
			.map((path) => relative(pageRoot, path));

		expect(offenders).toEqual([]);
	});

	it("keeps file routes as thin registrations over standalone pages", () => {
		const offenders = readTypeScriptFiles(routeRoot).flatMap((path) => {
			const source = readFileSync(path, "utf8");
			const importedModules = readImportedModules(path);
			const invalidImports = importedModules.filter(
				(module) => module !== "@tanstack/react-router" && !module.startsWith("~/page/"),
			);
			const pageImport = source.match(
				/import \{ ([A-Za-z0-9_]+) \} from ["']~\/page\/[^"']+["']/,
			);
			const directlyRegistersPage = pageImport
				? new RegExp(`component: ${pageImport[1]}[,\\n]`).test(source)
				: false;

			return invalidImports.length > 0 || !directlyRegistersPage
				? [
						`${relative(routeRoot, path)}: route must directly register exactly one page component`,
					]
				: [];
		});

		expect(offenders).toEqual([]);
	});
});
