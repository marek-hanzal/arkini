import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";

const collectTypeScriptFiles = (directory: string): string[] =>
	readdirSync(directory, {
		withFileTypes: true,
	}).flatMap((entry) => {
		const path = join(directory, entry.name);

		return entry.isDirectory()
			? collectTypeScriptFiles(path)
			: entry.isFile() && path.endsWith(".ts")
				? [
						path,
					]
				: [];
	});

const domainIdSchema =
	/\b(?:export\s+(?:const|type|namespace)|class)\s+[A-Za-z][A-Za-z0-9]*IdSchema\b/;

describe("canonical ID schema boundary", () => {
	it("keeps IdSchema as the only exact identity scalar schema", () => {
		const files = collectTypeScriptFiles("src/engine");
		const forbiddenSchemaFiles = files.filter(
			(path) => basename(path).endsWith("IdSchema.ts") && basename(path) !== "IdSchema.ts",
		);
		const forbiddenDeclarations = files.filter((path) => {
			if (path.endsWith("/common/schema/IdSchema.ts")) {
				return false;
			}

			return domainIdSchema.test(readFileSync(path, "utf8"));
		});

		expect({
			forbiddenDeclarations,
			forbiddenSchemaFiles,
		}).toEqual({
			forbiddenDeclarations: [],
			forbiddenSchemaFiles: [],
		});
	});
});
