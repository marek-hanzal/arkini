import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readEditorMcpItemCollectionTextFx } from "../../../server/editor-mcp/readEditorMcpItemCollectionTextFx";
import { readEditorMcpItemDetailTextFx } from "../../../server/editor-mcp/readEditorMcpItemDetailTextFx";
import { readEditorMcpItemEstimateTextFx } from "../../../server/editor-mcp/readEditorMcpItemEstimateTextFx";
import { readEditorMcpItemMetaTextFx } from "../../../server/editor-mcp/readEditorMcpItemMetaTextFx";
import { readEditorMcpItemRelationTextFx } from "../../../server/editor-mcp/readEditorMcpItemRelationTextFx";
import { readEditorMcpProjectTextFx } from "../../../server/editor-mcp/readEditorMcpProjectTextFx";
import type { EditorProject } from "~/editor/EditorProject";
import { editorItemEstimateMaximumQuantity } from "~/editor/estimator/EditorItemEstimateQuantitySchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const projectOf = (config: GameConfigSchema.Type): EditorProject => ({
	config,
	createdAtMs: 0,
	game: config.version,
	projectId: "mcp-tool-test",
	resources: [],
	revision: 0,
	title: config.meta.title,
	updatedAtMs: 0,
});

const createGraphProject = () => {
	const base = createJobTestConfig();
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	return projectOf(
		GameConfigSchema.parse({
			...base,
			start: {
				...base.start,
				board: [
					{
						itemId: "forge",
						space: 0,
						x: 0,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "water",
						quantity: 3,
					},
					{
						itemId: "tool",
						quantity: 1,
					},
				],
			},
			items: {
				...base.items,
				forge: {
					...forge,
					lines: forge.lines.map((line) => ({
						...line,
						output: {
							set: [
								{
									roll: [
										{
											drop: [
												{
													itemId: "ingot",
													placement: "drop",
													quantity: {
														max: 1,
														min: 1,
													},
													rules: [],
												},
											],
											type: "guaranteed",
										},
									],
								},
							],
						},
					})),
				},
				ingot: {
					...base.items.tool,
					id: "ingot",
					title: "Ingot",
					uid: "ingot",
				},
				unused: {
					...base.items.tool,
					id: "unused",
					title: "Unused",
					uid: "unused",
				},
			},
		}),
	);
};

describe("editor MCP tool text", () => {
	it("formats project, metadata, collection, and item detail independently", () => {
		const project = {
			...projectOf(editorTestPayload.config),
			projectId: "project-context",
			resources: editorTestPayload.resources,
		};
		const projectText = Effect.runSync(readEditorMcpProjectTextFx(project));
		const metaText = Effect.runSync(readEditorMcpItemMetaTextFx(project));
		const collectionText = Effect.runSync(
			readEditorMcpItemCollectionTextFx(project, {
				page: 1,
				pageSize: 25,
			}),
		);
		const fuzzyText = Effect.runSync(
			readEditorMcpItemCollectionTextFx(project, {
				page: 1,
				pageSize: 25,
				query: "watr",
			}),
		);
		const detailText = Effect.runSync(readEditorMcpItemDetailTextFx(project, "water"));

		expect(projectText).toContain("Project ID: project-context");
		expect(projectText).toContain("Resources: 2");
		expect(metaText).toBe("Total: 1\nsimple: 1");
		expect(fuzzyText).toBe(collectionText);
		expect(collectionText).toContain("- Water\n  ID: water\n  Type: simple");
		expect(detailText).toContain("ID: water\nUID: water\nType: simple");
		expect(() => Effect.runSync(readEditorMcpItemDetailTextFx(project, "missing"))).toThrow(
			"Item missing does not exist",
		);
	});

	it("filters and pages item collections without changing the tool text contract", () => {
		const project = createGraphProject();
		const producers = Effect.runSync(
			readEditorMcpItemCollectionTextFx(project, {
				itemTypes: [
					"producer",
				],
				page: 1,
				pageSize: 25,
			}),
		);
		const lastPage = Effect.runSync(
			readEditorMcpItemCollectionTextFx(project, {
				page: 3,
				pageSize: 2,
			}),
		);

		expect(producers).toContain("Item type filter (OR): producer");
		expect(producers).toContain("Type-filtered items: 1");
		expect(lastPage).toContain("Page: 3\nTotal pages: 3");
		expect(lastPage).toContain("Previous page: 2");
	});

	it("formats directional relation depth and every operation field", () => {
		const project = createGraphProject();
		const inputText = Effect.runSync(
			readEditorMcpItemRelationTextFx(project, {
				itemId: "water",
				level: 2,
				role: "input",
			}),
		);
		const outputText = Effect.runSync(
			readEditorMcpItemRelationTextFx(project, {
				itemId: "ingot",
				level: 1,
				role: "output",
			}),
		);

		expect(inputText).toContain("Item input\nItem ID: water");
		expect(inputText).toContain("Level: 2");
		expect(inputText).toContain('Level 1: line "Run"');
		expect(inputText).toContain("Inputs:\n    - tool");
		expect(inputText).toContain("Outputs:\n    - ingot");
		expect(outputText).toContain("forge [forge; producer] -> ingot [Ingot; simple]");
	});

	it("preserves unsupported output requirement reason and source", () => {
		const base = createGraphProject();
		const forge = base.config.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		const config = GameConfigSchema.parse({
			...base.config,
			items: {
				...base.config.items,
				forge: {
					...forge,
					lines: forge.lines.map((line) => {
						if (line.output === undefined)
							throw new Error("Expected authored line output.");
						return {
							...line,
							output: {
								...line.output,
								set: line.output.set.map((set) => ({
									...set,
									roll: set.roll.map((roll) => ({
										...roll,
										drop: roll.drop.map((drop) => ({
											...drop,
											rules: [
												{
													type: "enable",
													when: [
														{
															max: 3,
															min: 1,
															query: {
																scope: "universe",
																selector: {
																	itemId: "water",
																	type: "item",
																},
															},
															type: "range",
														},
													],
												},
											],
										})),
									})),
								})),
							},
						};
					}),
				},
			},
		});
		const text = Effect.runSync(
			readEditorMcpItemRelationTextFx(projectOf(config), {
				itemId: "ingot",
				level: 1,
				role: "output",
			}),
		);

		expect(text).toContain(
			"unsupported requirement: water [water; simple] (upper-bound, output-condition)",
		);
	});

	it("formats complete, unreachable, and bounded item estimates", () => {
		const project = createGraphProject();
		const complete = Effect.runSync(readEditorMcpItemEstimateTextFx(project, "ingot", 1));
		const unreachable = Effect.runSync(readEditorMcpItemEstimateTextFx(project, "unused", 1));
		const bounded = Effect.runSync(
			readEditorMcpItemEstimateTextFx(
				project,
				"ingot",
				editorItemEstimateMaximumQuantity + 1,
			),
		);

		expect(complete).toContain("Status: complete\nOptimistic parallel duration: 1 s");
		expect(complete).toContain("Enable prerequisites: acquired and included in time");
		expect(complete).toContain("Selected route graph:\n  - ingot [Ingot; simple]");
		expect(complete).not.toContain("Consumables:");
		expect(unreachable).toContain("Status: unreachable");
		expect(bounded).toContain(`static estimate limit of ${editorItemEstimateMaximumQuantity}`);
	});

	it("keeps official high-fan-in estimate text bounded and navigable", async () => {
		const project = projectOf(await readArkiniGameConfigSource());
		const highFanIn = Effect.runSync(
			readEditorMcpItemEstimateTextFx(project, "item:pollution", 1),
		);
		const optimistic = Effect.runSync(readEditorMcpItemEstimateTextFx(project, "item:axe", 1));

		expect(highFanIn).toContain("Selected route graph:");
		expect(highFanIn).toContain(" -> ");
		expect(highFanIn.length).toBeLessThan(100_000);
		expect(optimistic).toContain("Status: complete");
		expect(optimistic).toContain("Optimistic parallel duration:");
		expect(optimistic).not.toContain("Consumables:");
	});
});
