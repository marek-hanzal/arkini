import { expect, it } from "vitest";
import { compileGraphFactsFn } from "~/graph/fn/compileGraphFactsFn";
import {
	adversarialConfigFn,
	configFn,
	itemFn,
	lineFn,
	outputFn,
} from "./compileGraphFactsFn.test/fixtures";

it("does not collapse repeated drops or lose rules inside zero-chance Space and Template outcomes", () => {
	const facts = compileGraphFactsFn(adversarialConfigFn());
	const outputs = facts.edges.filter((edge) => edge.kind === "line-item-outcome");
	expect(
		outputs.map(({ from, to, annotations }) => [
			from,
			to,
			annotations.setIndex,
			annotations.rollIndex,
			annotations.outcomeIndex,
			annotations.setWeight,
			annotations.chance,
		]),
	).toEqual([
		[
			"item:A",
			"item:B",
			0,
			0,
			0,
			7,
			0,
		],
		[
			"item:A",
			"item:B",
			0,
			0,
			3,
			7,
			0,
		],
		[
			"item:A",
			"item:B",
			0,
			1,
			0,
			7,
			undefined,
		],
		[
			"item:A",
			"item:B",
			1,
			0,
			0,
			2,
			undefined,
		],
	]);
	expect(new Set(outputs.map((edge) => edge.id)).size).toBe(4);
	expect(new Set(outputs.map((edge) => edge.annotations.setId)).size).toBe(2);
	expect(new Set(outputs.map((edge) => edge.annotations.rollId)).size).toBe(3);
	expect(outputs[0]?.annotations.outcome).toMatchObject({
		placement: "random",
		quantity: {
			min: 2,
			max: 4,
		},
	});
	const tablePath = [
		"items",
		"A",
		"lines",
		0,
		"outcome",
		"set",
		0,
	];
	const rules = facts.edges.filter((edge) => edge.kind === "rule-reference");
	for (const path of [
		[
			...tablePath,
			"rules",
			0,
			"when",
			0,
			"query",
			"selector",
			"itemUid",
		],
		[
			...tablePath,
			"roll",
			0,
			"outcome",
			1,
			"rules",
			0,
			"when",
			0,
			"query",
			"selector",
			"itemUid",
		],
		[
			...tablePath,
			"roll",
			0,
			"outcome",
			2,
			"rules",
			0,
			"when",
			1,
			"query",
			"selector",
			"itemUid",
		],
	])
		expect(rules).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					source: path,
					to: "item:B",
				}),
			]),
		);
	expect(facts.edges).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				from: "item:A",
				to: "space:7",
				kind: "space-outcome",
				annotations: expect.objectContaining({
					chance: 0,
					boardLocal: false,
				}),
			}),
			expect.objectContaining({
				from: "item:A",
				to: "template:T",
				kind: "template-outcome",
				annotations: expect.objectContaining({
					chance: 0,
					boardLocal: true,
				}),
			}),
		]),
	);
});

it("keeps shared template assignments and repeated placements without binding templates to a space", () => {
	const facts = compileGraphFactsFn(adversarialConfigFn());
	expect(
		facts.edges
			.filter((edge) => edge.kind === "start-template")
			.map((edge) => [
				edge.from,
				edge.to,
				edge.source,
			]),
	).toEqual([
		[
			"space:0",
			"template:T",
			[
				"start",
				"spaces",
				0,
				"templateUid",
			],
		],
		[
			"space:7",
			"template:T",
			[
				"start",
				"spaces",
				1,
				"templateUid",
			],
		],
	]);
	expect(
		facts.edges
			.filter((edge) => edge.kind === "template-item")
			.map((edge) => [
				edge.from,
				edge.to,
				edge.annotations.position,
			]),
	).toEqual([
		[
			"template:T",
			"item:A",
			{
				x: 0,
				y: 0,
			},
		],
		[
			"template:T",
			"item:B",
			{
				x: 1,
				y: 0,
			},
		],
		[
			"template:T",
			"item:B",
			{
				x: 2,
				y: 0,
			},
		],
	]);
	expect(facts.edges.some((edge) => edge.from === "item:A" && edge.to === "template:T")).toBe(
		true,
	);
	expect(
		facts.edges.some((edge) => edge.from === "template:T" && edge.to.startsWith("space:")),
	).toBe(false);
});

it("does not invent a template destination from an earlier Space outcome", () => {
	const facts = compileGraphFactsFn(
		configFn({
			A: itemFn("A", {
				lines: [
					lineFn("L", {
						outcome: {
							set: [
								{
									rules: [],
									roll: [
										{
											type: "guaranteed",
											outcome: [
												{
													type: "space",
													space: 7,
													rules: [],
												},
												{
													type: "template",
													templateUid: "T",
													rules: [],
												},
												{
													type: "space",
													space: 8,
													rules: [],
												},
												{
													type: "template",
													templateUid: "T",
													rules: [],
												},
											],
										},
									],
								},
							],
						},
					}),
				],
			}),
		}),
	);
	const outputs = facts.edges.filter(
		(edge) => edge.kind === "space-outcome" || edge.kind === "template-outcome",
	);
	expect(
		outputs.map((edge) => [
			edge.from,
			edge.to,
			edge.annotations.outcomeIndex,
		]),
	).toEqual([
		[
			"item:A",
			"space:7",
			0,
		],
		[
			"item:A",
			"template:T",
			1,
		],
		[
			"item:A",
			"space:8",
			2,
		],
		[
			"item:A",
			"template:T",
			3,
		],
	]);
	expect(new Set(outputs.map((edge) => edge.id)).size).toBe(4);
	expect(facts.edges.some((edge) => edge.from === "space:7" || edge.from === "space:8")).toBe(
		false,
	);
});

it("retains authored Clock flags and outcomes even when no executable schedule connects them", () => {
	const facts = compileGraphFactsFn(
		configFn({
			A: itemFn("A", {
				lines: [
					lineFn("L", {
						clock: true,
						clockWeight: 3,
						outcome: outputFn("B"),
					}),
				],
			}),
			B: itemFn("B", {
				clock: {
					intervalMs: 100,
					enable: false,
					onExpire: outputFn("A"),
				},
			}),
		}),
	);
	expect(facts.operations).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				kind: "line",
				owner: "item:A",
				data: expect.objectContaining({
					clock: true,
					clockWeight: 3,
				}),
			}),
			expect.objectContaining({
				kind: "clock",
				owner: "item:B",
				data: expect.objectContaining({
					enable: false,
					intervalMs: 100,
				}),
			}),
		]),
	);
	expect(facts.edges).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				kind: "line-item-outcome",
				from: "item:A",
				to: "item:B",
			}),
			expect.objectContaining({
				kind: "clock-item-outcome",
				from: "item:B",
				to: "item:A",
			}),
		]),
	);
});
