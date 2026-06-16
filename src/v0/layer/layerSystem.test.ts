import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");
const packagePath = join(process.cwd(), "package.json");
const stylePath = join(process.cwd(), "src/app/styles.css");

const listSourceFiles = (directory: string): string[] =>
	readdirSync(directory).flatMap((entry) => {
		const path = join(directory, entry);
		const stat = statSync(path);

		if (stat.isDirectory()) return listSourceFiles(path);
		if (!/\.(ts|tsx)$/.test(path)) return [];

		return [
			path,
		];
	});

describe("global layer system", () => {
	it("keeps concrete z-index values centralized in CSS variables", () => {
		const styles = readFileSync(stylePath, "utf8");
		const rawZIndexDeclarations = (styles.match(/z-index:[^;]+;/g) ?? []).filter(
			(declaration) => !/z-index:\s*var\(/.test(declaration),
		);

		expect(rawZIndexDeclarations).toEqual([]);
	});

	it("does not use Tailwind z-index utility classes in v0 source", () => {
		const offenders = listSourceFiles(sourceRoot).flatMap((path) => {
			const source = readFileSync(path, "utf8");
			return /\bz-(?:\d+|\[)/.test(source)
				? [
						path.replace(process.cwd(), ""),
					]
				: [];
		});

		expect(offenders).toEqual([]);
	});
	it("keeps TileEngine layer API generic", () => {
		const offenders = [
			"LayerContext",
			"layerContext",
			"data-ak-tile-engine-layer=",
			'layerRole="board"',
			'layerRole="sheet"',
			'data-ak-tile-engine-layer-role="board"',
			'data-ak-tile-engine-layer-role="sheet"',
		].flatMap((needle) => {
			const matches = listSourceFiles(sourceRoot).filter(
				(path) =>
					!path.endsWith("layerSystem.test.ts") &&
					readFileSync(path, "utf8").includes(needle),
			);

			return matches.map((path) => ({
				needle,
				path: path.replace(process.cwd(), ""),
			}));
		});

		expect(offenders).toEqual([]);
	});
	it("keeps TileEngine DOM animations behind the cancellable runtime", () => {
		const offenders = listSourceFiles(join(sourceRoot, "v0/tile-engine")).flatMap((path) => {
			if (path.endsWith("TileMotionRuntime.ts")) return [];
			const source = readFileSync(path, "utf8");
			return /\.animate\(/.test(source) ||
				source.includes('from "motion"') ||
				source.includes("from 'motion'")
				? [
						path.replace(process.cwd(), ""),
					]
				: [];
		});

		expect(offenders).toEqual([]);
	});

	it("does not depend on the external Motion package", () => {
		const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
		const sourceOffenders = listSourceFiles(sourceRoot).flatMap((path) => {
			if (path.endsWith("layerSystem.test.ts")) return [];
			const source = readFileSync(path, "utf8");
			return source.includes('from "motion"') || source.includes("from 'motion'")
				? [
						path.replace(process.cwd(), ""),
					]
				: [];
		});

		expect(packageJson.dependencies?.motion).toBeUndefined();
		expect(sourceOffenders).toEqual([]);
	});
});
