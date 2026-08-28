import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readItemEstimateTextFx } from "../../../../electron/main/editor-mcp/tool/readItemEstimateTextFx";
import { readItemRelationTextFx } from "../../../../electron/main/editor-mcp/tool/readItemRelationTextFx";
import { editorItemEstimateMaximumQuantity } from "~/editor/estimator/EditorItemEstimateQuantitySchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createGraphProject, createToolProject } from "./support/createToolProject";

describe("editor MCP graph tool text", () => {
	it("formats directional relation depth and every operation field", () => {
		const project = createGraphProject();
		const inputText = Effect.runSync(
			readItemRelationTextFx(project, {
				itemId: "water",
				level: 2,
				role: "input",
			}),
		);
		const outputText = Effect.runSync(
			readItemRelationTextFx(project, {
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
			readItemRelationTextFx(createToolProject(config), {
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
		const complete = Effect.runSync(readItemEstimateTextFx(project, "ingot", 1));
		const unreachable = Effect.runSync(readItemEstimateTextFx(project, "unused", 1));
		const bounded = Effect.runSync(
			readItemEstimateTextFx(project, "ingot", editorItemEstimateMaximumQuantity + 1),
		);

		expect(complete).toContain("Status: complete\nOptimistic parallel duration: 1 s");
		expect(complete).toContain("Enable prerequisites: acquired and included in time");
		expect(complete).toContain("Selected route graph:\n  - ingot [Ingot; simple]");
		expect(complete).not.toContain("Consumables:");
		expect(unreachable).toContain("Status: unreachable");
		expect(bounded).toContain(`static estimate limit of ${editorItemEstimateMaximumQuantity}`);
	});
});
