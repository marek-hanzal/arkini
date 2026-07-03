#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { toJSONSchema } from "zod";
import { GameConfigAuthoringSchema } from "../../src/config/GameConfigSchema";

type JsonSchemaObject = Record<string, unknown>;

const defaultSchemaPath = "game/arkini.schema.json";

const createGameConfigJsonSchema = (): JsonSchemaObject => {
	const schema = toJSONSchema(GameConfigAuthoringSchema, {
		io: "input",
		reused: "ref",
		target: "draft-2020-12",
	}) as JsonSchemaObject;
	const jsonSchema = Object.fromEntries(
		Object.entries(schema).filter(([key]) => key !== "~standard"),
	);

	return {
		$schema: schema.$schema,
		$id: "https://arkini.local/schemas/game-config.schema.json",
		title: "Arkini game config",
		description: "Shared authoring schema for every Arkini source JSON config file.",
		...jsonSchema,
	};
};

const readSchemaPath = (args: readonly string[]) => {
	const pathIndex = args.indexOf("--out");

	if (pathIndex === -1) {
		return defaultSchemaPath;
	}

	const outputPath = args[pathIndex + 1];

	if (!outputPath) {
		throw new Error("Missing output path after --out.");
	}

	return outputPath;
};

const main = async () => {
	const args = process.argv.slice(2);
	const checkOnly = args.includes("--check");
	const schemaPath = resolve(readSchemaPath(args));
	const schemaText = `${JSON.stringify(createGameConfigJsonSchema(), null, "\t")}\n`;

	if (checkOnly) {
		const currentSchemaText = await readFile(schemaPath, "utf8").catch(() => undefined);

		if (currentSchemaText !== schemaText) {
			throw new Error(`${schemaPath} is stale. Run npm run game:schema to regenerate it.`);
		}

		console.log(`Game config JSON Schema is current: ${schemaPath}`);
		return;
	}

	await mkdir(dirname(schemaPath), {
		recursive: true,
	});
	await writeFile(schemaPath, schemaText);
	console.log(`Wrote game config JSON Schema: ${schemaPath}`);
};

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
