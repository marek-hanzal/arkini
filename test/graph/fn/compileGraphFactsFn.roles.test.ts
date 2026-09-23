import { Effect } from "effect";
import { validateGameConfigFx } from "~/game-config-validation/fx/validateGameConfigFx";
import { expect, it } from "vitest";
import { compileGraphFactsFn } from "~/graph/fn/compileGraphFactsFn";
import { adversarialConfigFn, configFn, itemFn } from "./compileGraphFactsFn.test/fixtures";

it("preserves independent item roles in a compiler-valid cyclic authored world", async () => {
	const config = adversarialConfigFn();
	const diagnostics = await Effect.runPromise(
		validateGameConfigFx({
			config,
			provenance: {
				items: {},
			},
		}),
	);
	expect(diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
	const facts = compileGraphFactsFn(config);
	const inputs = facts.edges.filter(
		(edge) => edge.kind.startsWith("line-") && edge.kind !== "line-item-outcome",
	);
	expect(
		inputs.map(({ from, to, kind, source }) => [
			from,
			to,
			kind,
			source.slice(4),
		]),
	).toEqual(
		expect.arrayContaining([
			[
				"item:B",
				"item:A",
				"line-material",
				[
					"input",
					0,
					"query",
					"selector",
					"itemUid",
				],
			],
			[
				"item:B",
				"item:A",
				"line-material",
				[
					"input",
					1,
					"query",
					"selector",
					"itemUid",
				],
			],
			[
				"item:B",
				"item:A",
				"line-unit-selector",
				[
					"input",
					2,
					"query",
					"selector",
					"itemUid",
				],
			],
			[
				"item:B",
				"item:A",
				"line-unit-cost",
				[
					"input",
					2,
					"units",
					"from",
				],
			],
			[
				"item:A",
				"item:A",
				"line-unit-cost",
				[
					"input",
					0,
					"units",
					"from",
				],
			],
			[
				"item:A",
				"item:A",
				"line-unit-cost",
				[
					"input",
					3,
					"units",
					"from",
				],
			],
			[
				"item:A",
				"item:A",
				"line-unit-selector",
				[
					"input",
					4,
					"query",
					"selector",
					"itemUid",
				],
			],
			[
				"item:A",
				"item:A",
				"line-unit-cost",
				[
					"input",
					4,
					"units",
					"from",
				],
			],
			[
				"item:B",
				"item:A",
				"line-unit-selector",
				[
					"input",
					5,
					"query",
					"selector",
					"itemUid",
				],
			],
			[
				"item:A",
				"item:A",
				"line-unit-cost",
				[
					"input",
					5,
					"units",
					"from",
				],
			],
			[
				"item:C",
				"item:B",
				"line-material",
				[
					"input",
					0,
					"query",
					"selector",
					"itemUid",
				],
			],
			[
				"item:A",
				"item:C",
				"line-material",
				[
					"input",
					0,
					"query",
					"selector",
					"itemUid",
				],
			],
		]),
	);
	expect(inputs).toHaveLength(12);
	expect(
		inputs
			.filter((edge) => edge.kind === "line-material" && edge.to === "item:A")
			.map((edge) => edge.annotations.input),
	).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				mode: "consume",
				quantity: {
					min: 1,
					max: 3,
				},
				units: {
					from: "self",
					cost: 2,
				},
			}),
			expect.objectContaining({
				mode: "reserve",
				quantity: {
					min: 1,
					max: 1,
				},
			}),
		]),
	);
	expect(facts.edges).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				from: "item:A",
				to: "item:D",
				kind: "depletion-item-outcome",
			}),
			expect.objectContaining({
				from: "item:A",
				to: "item:B",
				kind: "clock-item-outcome",
			}),
		]),
	);
});

it("keeps shadowed directional merges and receiver transport ownership distinct", () => {
	const facts = compileGraphFactsFn(adversarialConfigFn());
	const merges = facts.edges.filter((edge) => edge.kind.startsWith("merge-"));
	expect(
		merges.map(({ from, to, kind, source, annotations }) => [
			from,
			to,
			kind,
			source[3],
			annotations.role,
		]),
	).toEqual(
		expect.arrayContaining([
			[
				"item:A",
				"item:B",
				"merge-target",
				0,
				"target",
			],
			[
				"item:A",
				"item:A",
				"merge-source-spend",
				0,
				"source",
			],
			[
				"item:A",
				"item:B",
				"merge-target-spend",
				0,
				"target",
			],
			[
				"item:A",
				"item:B",
				"merge-target",
				1,
				"target",
			],
			[
				"item:A",
				"item:D",
				"merge-replacement",
				1,
				"target",
			],
			[
				"item:B",
				"item:D",
				"merge-target-replacement",
				1,
				"target",
			],
			[
				"item:A",
				"space:7",
				"merge-space",
				2,
				"receiver",
			],
			[
				"item:A",
				"item:D",
				"merge-replacement",
				2,
				"receiver",
			],
		]),
	);
	expect(merges.filter((edge) => edge.kind === "merge-target" && edge.source[3] === 2)).toEqual(
		[],
	);
	expect(
		merges
			.filter((edge) => edge.kind === "merge-item-outcome")
			.map((edge) => [
				edge.from,
				edge.to,
				edge.source[3],
			]),
	).toEqual([
		[
			"item:A",
			"item:B",
			0,
		],
		[
			"item:A",
			"item:B",
			2,
		],
	]);
	const receiverSpend = configFn({
		P: itemFn("P", {
			units: {
				amount: 1,
			},
			merge: [
				{
					action: "space",
					space: 9,
					effect: "spend",
				},
			],
		}),
	});
	expect(
		compileGraphFactsFn(receiverSpend).edges.filter(
			(edge) => edge.kind === "merge-target-spend",
		),
	).toEqual([
		expect.objectContaining({
			from: "item:P",
			to: "item:P",
			annotations: expect.objectContaining({
				role: "receiver",
			}),
		}),
	]);
});
