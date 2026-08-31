import { z } from "zod";

import { ProjectSchema } from "~/game-config-source/schema/ProjectSchema";

/** The canonical generated schema shared by project root and item authoring files. */
export const GameProjectJsonSchema = (() => {
	const schema = z.toJSONSchema(ProjectSchema, {
		reused: "inline",
		target: "draft-2020-12",
	});
	const rootId = schema.$id;
	if (typeof rootId !== "string")
		throw new Error("The exported JSON Schema requires a root $id.");

	const visitFn = (value: unknown): void => {
		if (Array.isArray(value)) {
			for (const child of value) visitFn(child);
			return;
		}
		if (typeof value !== "object" || value === null) return;
		const record = value as Record<string, unknown>;
		if (typeof record.$ref === "string" && record.$ref.startsWith("#/$defs/"))
			record.$ref = `${rootId}${record.$ref}`;
		for (const child of Object.values(record)) visitFn(child);
	};
	visitFn(schema);
	return schema;
})();
