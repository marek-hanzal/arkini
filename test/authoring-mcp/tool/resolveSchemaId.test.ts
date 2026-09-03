import { describe, expect, it } from "vitest";
import { z } from "zod";

import { resolveSchemaId } from "~/authoring-mcp/tool/resolveSchemaId";

describe("MCP schema identity", () => {
	it("requires every referenced schema to publish an exact registry ID", () => {
		expect(
			resolveSchemaId(
				z.string().meta({
					id: "ExampleSchema",
				}),
			),
		).toBe("ExampleSchema");
		expect(() => resolveSchemaId(z.string())).toThrowError("MCP schema must define meta.id.");
	});
});
