import Ajv2020 from "ajv/dist/2020";
import { Effect } from "effect";
import { createDraftFn } from "~/item-authoring/fn/createDraftFn";
import { afterEach, describe, expect, it } from "vitest";

import {
	cleanupMcpHarnesses,
	connectMcpClient,
	createMcpHarness,
} from "./support/createMcpHarness";

afterEach(cleanupMcpHarnesses);

describe("editor MCP authoring schema registry", () => {
	it("serves the complete authoring schema graph by exact registry ID", async () => {
		const { ownership, port } = await createMcpHarness();
		await Effect.runPromise(ownership.startLocalFx);
		const client = await connectMcpClient(port);
		const schemasById = new Map<string, Record<string, unknown>>();
		const readSchemaDetail = async (id: string) => {
			const cached = schemasById.get(id);
			if (cached !== undefined) return cached;
			const result = await client.callTool({
				name: "schema_detail",
				arguments: {
					id,
				},
			});
			expect(result.isError, id).not.toBe(true);
			const content = result.content[0];
			if (content?.type !== "text") throw new Error(`Missing schema detail for ${id}.`);
			const schema = JSON.parse(content.text) as Record<string, unknown>;
			schemasById.set(id, schema);
			return schema;
		};

		const producer = await readSchemaDetail("urn:arkini:schema:mcp:create-common-item-input");
		expect(producer).toMatchObject({
			$id: "urn:arkini:schema:mcp:create-common-item-input",
			properties: {
				asset: {
					$ref: "AssetSchema",
				},
				lines: {
					items: {
						$ref: "LineSchema",
					},
				},
				merge: {
					items: {
						$ref: "MergeSchema",
					},
				},
			},
			type: "object",
		});
		expect(
			await readSchemaDetail("urn:arkini:schema:mcp:edit-common-item-input"),
		).toMatchObject({
			properties: {
				patch: {
					$ref: "CommonItemPatchSchema",
				},
			},
		});
		expect(await readSchemaDetail("CommonItemPatchSchema")).toMatchObject({
			minProperties: 1,
			type: "object",
		});
		expect(await readSchemaDetail("urn:arkini:schema:mcp:edit-project-input")).toMatchObject({
			properties: {
				patch: {
					minProperties: 1,
					properties: {
						start: {
							$ref: "StartSchema",
						},
					},
				},
			},
		});
		expect(await readSchemaDetail("LineSchema")).toMatchObject({
			properties: {
				input: {
					items: {
						$ref: "InputSchema",
					},
				},
				output: {
					$ref: "OutputSchema",
				},
				rules: {
					items: {
						$ref: "line.RuleSchema",
					},
				},
			},
		});
		expect(await readSchemaDetail("OutputSchema")).toMatchObject({
			properties: {
				set: {
					items: {
						$ref: "roll.SetSchema",
					},
				},
			},
		});
		expect(await readSchemaDetail("roll.SetSchema")).toMatchObject({
			properties: {
				roll: {
					items: {
						$ref: "RollSchema",
					},
				},
			},
		});
		for (const id of [
			"InputSchema",
			"RollSchema",
			"line.RuleSchema",
			"action.RuleSchema",
			"MergeSchema",
		]) {
			expect(await readSchemaDetail(id), id).toHaveProperty("oneOf");
		}
		expect(await readSchemaDetail("AssetSchema")).toMatchObject({
			properties: {
				default: {
					$ref: "item.CompositionSchema",
				},
			},
		});
		expect(await readSchemaDetail("item.CompositionSchema")).toHaveProperty("anyOf");
		expect(await readSchemaDetail("StartSchema")).toMatchObject({
			properties: {
				board: {
					items: {
						$ref: "start.BoardItemSchema",
					},
				},
				inventory: {
					items: {
						$ref: "start.InventoryItemSchema",
					},
				},
				toolbar: {
					items: {
						$ref: "start.ToolbarItemSchema",
					},
				},
			},
		});
		for (const id of [
			"start.BoardItemSchema",
			"start.InventoryItemSchema",
			"start.ToolbarItemSchema",
		]) {
			expect(await readSchemaDetail(id), id).toMatchObject({
				additionalProperties: false,
				properties: expect.any(Object),
				type: "object",
			});
		}
		const itemTypes = [
			"common",
			"clock",
			"blueprint",
			"temporary",
			"inventory",
		];
		const pending = [
			...itemTypes.flatMap((type) => [
				`urn:arkini:schema:mcp:create-${type}-item-input`,
				`urn:arkini:schema:mcp:edit-${type}-item-input`,
			]),
			"urn:arkini:schema:mcp:edit-project-input",
		];
		const visited = new Set<string>();
		while (pending.length > 0) {
			const id = pending.shift();
			if (id === undefined || visited.has(id)) continue;
			visited.add(id);
			const stack: unknown[] = [
				await readSchemaDetail(id),
			];
			while (stack.length > 0) {
				const value = stack.pop();
				if (Array.isArray(value)) {
					stack.push(...value);
					continue;
				}
				if (typeof value !== "object" || value === null) continue;
				const entries = Object.entries(value);
				expect(entries.length, `${id} contains an opaque schema`).toBeGreaterThan(0);
				for (const [key, child] of entries) {
					if (key === "$ref" && typeof child === "string") pending.push(child);
					else stack.push(child);
				}
			}
		}
		expect(visited.size).toBeGreaterThan(70);
		expect([
			...visited,
		]).toEqual(
			expect.arrayContaining([
				"InputSchema",
				"OutputSchema",
				"RollSchema",
				"line.RuleSchema",
				"action.RuleSchema",
				"MergeSchema",
				"AssetSchema",
				"item.CompositionSchema",
				"StartSchema",
				"start.BoardItemSchema",
				"start.InventoryItemSchema",
				"start.ToolbarItemSchema",
			]),
		);

		// MCP clients validate this exported graph before sending canonical authoring writes.
		const ajv = new Ajv2020({
			strict: false,
		});
		const schemaUri = (id: string) => `https://schema.arkini.test/${encodeURIComponent(id)}`;
		// MCP refs are exact registry IDs; give Ajv absolute addresses for that same graph.
		for (const [id, schema] of schemasById)
			ajv.addSchema(
				JSON.parse(
					JSON.stringify(schema, (key, value) =>
						(key === "$id" || key === "$ref") && typeof value === "string"
							? schemaUri(value)
							: value,
					),
				),
				schemaUri(id),
			);
		const validateCreate = ajv.getSchema(
			schemaUri("urn:arkini:schema:mcp:create-common-item-input"),
		);
		const validatePatch = ajv.getSchema(schemaUri("CommonItemPatchSchema"));
		if (validateCreate === undefined || validatePatch === undefined)
			throw new Error("Missing public Common schema.");
		const clockDraft = createDraftFn({
			type: "clock",
			uid: "uid:template",
			resourceId: "asset:template",
		});
		if (clockDraft.type !== "clock") throw new Error("Expected Clock draft.");
		const action = {
			type: "space",
			space: 1,
		};
		const input = {
			id: "item:portal",
			title: "Portal",
			action,
		};
		expect(validateCreate(input), JSON.stringify(validateCreate.errors)).toBe(true);
		expect(
			validateCreate({
				...input,
				lines: [],
			}),
			JSON.stringify(validateCreate.errors),
		).toBe(true);
		expect(
			validateCreate({
				...input,
				lines: clockDraft.lines,
			}),
		).toBe(false);
		expect(
			validateCreate({
				id: "item:workshop",
				title: "Workshop",
				lines: clockDraft.lines,
			}),
			JSON.stringify(validateCreate.errors),
		).toBe(true);
		// Patches may clear an action and replace lines together; the complete candidate enforces exclusivity.
		expect(
			validatePatch({
				action: null,
				lines: clockDraft.lines,
			}),
			JSON.stringify(validatePatch.errors),
		).toBe(true);

		const wrongCase = await client.callTool({
			name: "schema_detail",
			arguments: {
				id: "lineschema",
			},
		});
		expect(wrongCase).toMatchObject({
			isError: true,
			content: [
				{
					text: 'Editor operation failed: Schema "lineschema" is not registered.',
				},
			],
		});
	});
});
