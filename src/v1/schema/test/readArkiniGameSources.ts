import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ArkiniDirectory = fileURLToPath(new URL("../../../../game/arkini/", import.meta.url));

export interface ArkiniGameSource {
	readonly path: string;
	readonly value: unknown;
}

const readJsonFiles = (directory: string): string[] =>
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

export const readArkiniGameSources = (): readonly ArkiniGameSource[] =>
	readJsonFiles(ArkiniDirectory)
		.sort()
		.map((path) => ({
			path,
			value: JSON.parse(readFileSync(path, "utf8")),
		}));
