import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const uiRoot = fileURLToPath(new URL("../../../src/ui/", import.meta.url));
const focusReset = `:where(:focus, :focus-visible) {
\toutline: none !important;
}`;
const visualFocusPattern =
	/(?:\b(?:group-)?focus(?:-visible|-within)?:|:focus(?:-visible|-within)?)/;

const readUiSourceFiles = (directory: string): ReadonlyArray<string> =>
	readdirSync(directory, {
		withFileTypes: true,
	}).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return readUiSourceFiles(path);
		return [
			".css",
			".ts",
			".tsx",
		].includes(extname(path))
			? [
					path,
				]
			: [];
	});

describe("focus presentation", () => {
	it("keeps keyboard focus visually neutral throughout the UI", () => {
		const violations = readUiSourceFiles(uiRoot).flatMap((path) => {
			const source = readFileSync(path, "utf8");
			const presentationSource =
				path === join(uiRoot, "styles.css") ? source.replace(focusReset, "") : source;
			return visualFocusPattern.test(presentationSource)
				? [
						relative(uiRoot, path),
					]
				: [];
		});

		expect(readFileSync(join(uiRoot, "styles.css"), "utf8")).toContain(focusReset);
		expect(violations).toEqual([]);
	});
});
