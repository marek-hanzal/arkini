import Ajv2020 from "ajv/dist/2020";
import { expect } from "vitest";

export const isJsonSchemaRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Protects the public schema contract consumed by authoring tools and MCP clients. */
export const expectNamedJsonSchemaGraph = (
	schema: Record<string, unknown>,
	{
		id,
		dialect,
		root = "object",
	}: {
		readonly id: string;
		readonly dialect?: string;
		readonly root?: "object" | "union";
	},
) => {
	expect(() =>
		new Ajv2020({
			strict: false,
		}).compile(schema),
	).not.toThrow();
	expect(schema).toMatchObject({
		$id: id,
		...(dialect === undefined
			? {}
			: {
					$schema: dialect,
				}),
		...(root === "object"
			? {
					additionalProperties: false,
					type: "object",
				}
			: {
					anyOf: expect.any(Array),
				}),
	});
	if (root === "union") expect(schema.anyOf).toHaveLength(2);
	expect(schema.title).toEqual(expect.any(String));
	expect(schema.description).toEqual(expect.any(String));

	const definitions = isJsonSchemaRecord(schema.$defs) ? schema.$defs : {};
	const anonymous: Array<string> = [];
	const brokenReferences: Array<string> = [];
	const unconstrainedSchemas: Array<string> = [];
	const visit = (value: unknown, path: string, parentKey?: string) => {
		if (!isJsonSchemaRecord(value) && !Array.isArray(value)) return;
		if (isJsonSchemaRecord(value)) {
			if (Object.keys(value).length === 0 && parentKey !== "properties")
				unconstrainedSchemas.push(path);
			if (
				typeof value.$ref === "string" &&
				(value.$ref.startsWith("#/$defs/") || value.$ref.startsWith(`${id}#/$defs/`))
			) {
				const name = value.$ref.slice(value.$ref.indexOf("#/$defs/") + "#/$defs/".length);
				if (name.startsWith("__schema")) anonymous.push(value.$ref);
				if (!(name in definitions)) brokenReferences.push(value.$ref);
			}
		}
		for (const [key, child] of Object.entries(value)) visit(child, `${path}/${key}`, key);
	};
	visit(schema, "#");

	expect(anonymous).toEqual([]);
	expect(brokenReferences).toEqual([]);
	expect(unconstrainedSchemas).toEqual([]);
	for (const [name, definition] of Object.entries(definitions)) {
		expect(name).not.toMatch(/^__schema\d+$/);
		expect(definition).toMatchObject({
			description: expect.any(String),
		});
	}
};
