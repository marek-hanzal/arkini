import { Cause, Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

import { readItemEstimateTextFx } from "~electron/main/editor-mcp/tool/readItemEstimateTextFx";
import { readItemRelationTextFx } from "~electron/main/editor-mcp/tool/readItemRelationTextFx";
import { itemEstimateMaximumQuantity } from "~/estimate/schema/ItemEstimateQuantitySchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createGraphProject, createToolProject } from "./support/createToolProject";
import { createRelationTraversalProject } from "./readGraphTextFx.test/fixture";

describe("editor MCP graph tool text", () => {
	it("formats directional relation depth and every operation field", () => {
		const project = createRelationTraversalProject();
		const inputText = Effect.runSync(
			readItemRelationTextFx(project, {
				itemId: "water",
				level: 2,
				role: "input",
			}),
		);
		const outputText = Effect.runSync(
			readItemRelationTextFx(project, {
				itemId: "plate",
				level: 2,
				role: "output",
			}),
		);

		expect(inputText).toContain("Item input\nItem ID: water");
		expect(inputText).toContain("Level: 2");
		expect(inputText.match(/^- Level \d+:.*$/gm)).toEqual([
			'- Level 1: line "Run"',
			'- Level 2: line "Mill Run"',
		]);
		expect(inputText.match(/^    - .* -> .*$/gm)).toEqual([
			"    - water [water; simple] -> forge [forge; producer]",
			"    - forge [forge; producer] -> mill [Mill; producer]",
		]);
		expect(inputText).toContain("Inputs:\n    - tool");
		expect(inputText).toContain("Outputs:\n    - ingot");
		expect(outputText.match(/^- Level \d+:.*$/gm)).toEqual([
			'- Level 1: line "Ingot Run"',
			'- Level 2: line "Run"',
			'- Level 2: line "Kiln Run"',
		]);
		expect(outputText.match(/^    - .* -> .*$/gm)).toEqual([
			"    - ingot [Ingot; producer] -> plate [Plate; simple]",
			"    - forge [forge; producer] -> ingot [Ingot; producer]",
			"    - kiln [Kiln; producer] -> ingot [Ingot; producer]",
		]);
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

	it("preserves estimate status, selected quantity, and quantity bounds", () => {
		const project = createGraphProject();
		const complete = Effect.runSync(readItemEstimateTextFx(project, "ingot", 1));
		const unreachable = Effect.runSync(readItemEstimateTextFx(project, "unused", 1));
		const bounded = Effect.runSync(
			readItemEstimateTextFx(project, "ingot", itemEstimateMaximumQuantity + 1),
		);

		expect(complete).toContain("Status: complete");
		expect(complete).toContain("Approximate action runs: 1");
		expect(complete).toContain("- ingot [Ingot; simple] x 1 via");
		expect(unreachable).toContain("Status: unreachable");
		expect(bounded).toContain(`static estimate limit of ${itemEstimateMaximumQuantity}`);
	});

	it("rejects a missing estimate item through the typed failure channel", () => {
		const exit = Effect.runSync(
			readItemEstimateTextFx(createGraphProject(), "missing", 1).pipe(Effect.exit),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(Cause.hasDies(exit.cause)).toBe(false);
			expect(Cause.pretty(exit.cause)).toContain(
				"Item missing does not exist in the open project.",
			);
		}
	});
});
