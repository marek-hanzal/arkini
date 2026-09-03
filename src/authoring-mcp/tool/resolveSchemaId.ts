import type { ZodType } from "zod";

/** Resolves the exact registry identity required by an MCP-facing schema. */
export const resolveSchemaId = (schema: ZodType): string => {
	const id = schema.meta()?.id;
	if (typeof id !== "string") throw new Error("MCP schema must define meta.id.");
	return id;
};
