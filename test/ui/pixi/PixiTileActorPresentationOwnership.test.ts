import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const readTypeScriptFiles = (directory: string): string[] =>
	readdirSync(directory, {
		withFileTypes: true,
	}).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return readTypeScriptFiles(path);
		return entry.isFile() && entry.name.endsWith(".ts")
			? [
					path,
				]
			: [];
	});

describe("Pixi tile actor presentation ownership", () => {
	it("keeps every retained actor root pose and alpha write inside the typed animator", () => {
		const sourceRoot = join(process.cwd(), "src/ui/pixi");
		const mutations = readTypeScriptFiles(sourceRoot).flatMap((path) =>
			readFileSync(path, "utf8")
				.split("\n")
				.flatMap((line, index) =>
					/\.container\.(?:alpha|x|y)\s*=|\.container\.(?:pivot|scale)\.set\(/.test(line)
						? [
								{
									file: relative(process.cwd(), path),
									line: index + 1,
									source: line.trim(),
								},
							]
						: [],
				),
		);

		expect(
			mutations.filter(({ file, source }) => {
				if (file.endsWith("/animation/createPixiActorAnimatorFx.ts")) return false;
				return !(
					file.endsWith("/actor/transitionPixiTileActorVisualFx.ts") &&
					source.includes(".container.alpha =")
				);
			}),
		).toEqual([]);
	});
});
