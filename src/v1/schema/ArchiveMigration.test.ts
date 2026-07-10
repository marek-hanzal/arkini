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

	it("keeps only the explicitly deferred item definitions in the archive", () => {
		const archiveItemIds = [
			...readItemIds(
				readJsonFiles(ArchiveDirectory).map((path) =>
					JSON.parse(readFileSync(path, "utf8")),
				),
			),
		].sort();

		expect(archiveItemIds).toEqual([
			"item:board-memory",
			"item:inventory",
			"producer:shrine-t1",
		]);
	});

	it("preserves lumberjack output chances for every wood-source tier", () => {
		const lumberjack = readArkiniGameSources()
			.flatMap(({ value }) =>
				Object.values(
					(
						value as {
							readonly items?: Readonly<Record<string, unknown>>;
						}
					).items ?? {},
				),
			)
			.find(
				(item) =>
					(
						item as {
							readonly id?: string;
						}
					).id === "producer:lumberjack-t1",
			) as {
			readonly lines: readonly {
				readonly input: readonly {
					readonly query: {
						readonly selector: {
							readonly itemId: string;
						};
					};
				}[];
				readonly output: {
					readonly set: readonly {
						readonly roll: readonly {
							readonly chance: number;
						}[];
					}[];
				};
			}[];
		};

		expect(
			lumberjack.lines.map((line) => ({
				chance: line.output.set[0].roll[0].chance,
				sourceItemId: line.input[0].query.selector.itemId,
			})),
		).toEqual([
			{
				chance: 0.5,
				sourceItemId: "item:tree",
			},
			{
				chance: 0.65,
				sourceItemId: "item:double-tree",
			},
			{
				chance: 0.85,
				sourceItemId: "item:micro-forest",
			},
		]);
	});
});
