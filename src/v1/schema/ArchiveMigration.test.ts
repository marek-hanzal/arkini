import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readArkiniGameSources } from "./test/readArkiniGameSources";

const ArchiveDirectory = fileURLToPath(new URL("../../../game/archive/", import.meta.url));

const readJsonFiles = (directory: string): readonly string[] =>
	readdirSync(directory, {
		withFileTypes: true,
	}).flatMap((entry) => {
		const path = join(directory, entry.name);

		if (entry.isDirectory()) {
			return readJsonFiles(path);
		}

		return entry.isFile() && entry.name.endsWith(".json")
			? [
					path,
				]
			: [];
	});

const readItemIds = (sources: readonly unknown[]): ReadonlySet<string> =>
	new Set(
		sources.flatMap((source) =>
			Object.keys(
				(
					source as {
						readonly items?: Readonly<Record<string, unknown>>;
					}
				).items ?? {},
			),
		),
	);

describe("archive migration", () => {
	it("keeps migrated item definitions out of the archive backlog", () => {
		const currentItemIds = readItemIds(readArkiniGameSources().map(({ value }) => value));
		const archiveItemIds = readItemIds(
			readJsonFiles(ArchiveDirectory).map((path) => JSON.parse(readFileSync(path, "utf8"))),
		);
		const duplicateItemIds = [
			...archiveItemIds,
		].filter((itemId) => currentItemIds.has(itemId));

		expect(duplicateItemIds).toEqual([]);
	});
});
