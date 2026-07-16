import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

describe("live game bridge boundary", () => {
	it("keeps runtime selection on the live external-store pipe without a React mirror", () => {
		const source = read("src/bridge/runtime/useRuntimeSelector.ts");

		expect(source).toContain("useSyncExternalStore");
		expect(source).toContain("game.getSnapshot()");
		expect(source).toContain("game.subscribe");
		expect(source).not.toContain("useState");
		expect(source).not.toContain("useEffect");
	});

	it("keeps board projection derived from the live runtime selector", () => {
		const source = read("src/bridge/board/useBoard.ts");

		expect(source).toContain("useRuntimeSelector(selector)");
		expect(source).not.toContain("useState");
		expect(source).not.toContain("useEffect");
	});

	it("keeps the headless tile domain independent from game and bridge truth", () => {
		const offenders = readTypeScriptFiles("src/ui/tile").filter((path) =>
			/~\/(?:engine|bridge)\//.test(read(path)),
		);

		expect(offenders).toEqual([]);
		expect(read("src/ui/board/BoardTile.tsx")).toContain(
			'import { useTile } from "~/ui/tile/useTile"',
		);
	});
});
