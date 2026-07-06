import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AuditFinding } from "./AuditFinding";
import { readFiles } from "./readAuditFiles";

const sourceRoot = "game/arkini";

const isJsonSchemaReference = (value: unknown): value is string =>
	typeof value === "string" && value.trim().length > 0;

const isExternalSchemaReference = (schema: string) => /^[a-z][a-z0-9+.-]*:/i.test(schema);

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

const readSchemaPathFinding = ({
	path,
	schema,
}: {
	path: string;
	schema: string;
}): AuditFinding[] => {
	if (isExternalSchemaReference(schema)) return [];

	const schemaPath = resolve(dirname(path), schema);
	if (existsSync(schemaPath)) return [];

	return [
		{
			message: `$schema points to a missing file: ${schema}`,
			path,
		},
	];
};

export const auditGameSourceJsonSchemas = (): AuditFinding[] =>
	readFiles(sourceRoot)
		.filter((path) => path.endsWith(".json"))
		.filter((path) => !path.endsWith(".schema.json"))
		.flatMap((path) => {
			const json = readJson(path);

			if (!json || typeof json !== "object" || Array.isArray(json)) {
				return [
					{
						message: "Game source JSON must be an object with a $schema reference.",
						path,
					},
				];
			}

			const schema = (json as Record<string, unknown>).$schema;
			if (!isJsonSchemaReference(schema)) {
				return [
					{
						message: "Game source JSON must include a non-empty $schema reference.",
						path,
					},
				];
			}

			return readSchemaPathFinding({
				path,
				schema,
			});
		});
