import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readEditorMcpItemEstimateTextFx } from "../../../../electron/main/editor-mcp/tool/readEditorMcpItemEstimateTextFx";
import { readEditorMcpItemRelationTextFx } from "../../../../electron/main/editor-mcp/tool/readEditorMcpItemRelationTextFx";
import { editorItemEstimateMaximumQuantity } from "~/editor/estimator/EditorItemEstimateQuantitySchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";
import {
	createEditorMcpGraphProject,
	createEditorMcpToolProject,
} from "./support/createEditorMcpToolProject";

describe("editor MCP graph tool text", () => {
	it("formats directional relation depth and every operation field", () => {
		const project = createEditorMcpGraphProject();
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
		const base = createEditorMcpGraphProject();
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
			readEditorMcpItemRelationTextFx(createEditorMcpToolProject(config), {
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
		const project = createEditorMcpGraphProject();
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
		const project = createEditorMcpToolProject(await readArkiniGameConfigSource());
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
