import { Cause, Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

import { readItemEstimateTextFx } from "~/authoring-mcp/tool/readItemEstimateTextFx";
import { readItemRelationTextFx } from "~/authoring-mcp/tool/readItemRelationTextFx";
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
			"    - water [water] -> forge [forge]",
			"    - forge [forge] -> mill [Mill]",
		]);
		expect(inputText).toContain("Inputs: water [water] @far x3 consume");
		expect(inputText).toContain("Item acquisition witnesses:\n    - ingot");
		expect(outputText.match(/^- Level \d+:.*$/gm)).toEqual([
			'- Level 1: line "Ingot Run"',
			'- Level 2: line "Run"',
			'- Level 2: line "Kiln Run"',
		]);
		expect(outputText.match(/^    - .* -> .*$/gm)).toEqual([
			"    - ingot [Ingot] -> plate [Plate]",
			"    - forge [forge] -> ingot [Ingot]",
			"    - kiln [Kiln] -> ingot [Ingot]",
		]);
	});

	it("preserves unsupported output requirement reason and source", () => {
		const base = createGraphProject();
		const forge = base.config.items.forge;
		const config = GameConfigSchema.parse({
			...base.config,
			items: {
				...base.config.items,
				forge: {
					...forge,
					lines: forge.lines.map((line) => {
						if (line.outcome === undefined)
							throw new Error("Expected authored line output.");
						return {
							...line,
							outcome: {
								...line.outcome,
								set: line.outcome.set.map((set) => ({
									...set,
									roll: set.roll.map((roll) => ({
										...roll,
										outcome: roll.outcome.map((drop) => ({
											...drop,
											rules: [
												{
													type: "enable",
													when: [
														{
															max: 3,
															min: 1,
															query: {
																distance: "far",
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
			"unsupported requirement: water [water] (upper-bound, output-condition)",
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
		expect(complete).toContain("- ingot [Ingot] x 1 via");
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

it.each([
	"summary",
	"full",
] as const)("retains Space outcomes beside item acquisition in %s relations", (detail) => {
	const project = createRelationTraversalProject();
	const outcome = project.config.items.forge.lines[0]?.outcome?.set[0]?.roll[0]?.outcome;
	if (outcome === undefined) throw new Error("Missing fixture outcomes.");
	outcome.push({
		type: "space",
		space: 7,
		rules: [],
	});
	const text = Effect.runSync(
		readItemRelationTextFx(project, {
			itemId: "water",
			level: 1,
			role: "input",
			detail,
		}),
	);
	expect(text).toContain("Space 7");
	expect(text).toContain("Ingot [ingot] x1; Space 7");
});
