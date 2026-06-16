import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");
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
});
