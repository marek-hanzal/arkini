import { expect, it } from "vitest";
import { compileGraphFactsFn } from "~/graph/fn/compileGraphFactsFn";
import {
	adversarialConfigFn,
	configFn,
	expiryLineFn,
	itemFn,
	lineFn,
	outputFn,
	queryFn,
} from "./compileGraphFactsFn.test/fixtures";

it("retains absence, veto, presentation and runtime rule references with their exact conjuncts", () => {
	const facts = compileGraphFactsFn(adversarialConfigFn());
	const rules = facts.edges.filter(
		(edge) =>
			edge.kind === "rule-reference" &&
			edge.source[2] === "lines" &&
			edge.source[4] === "rules",
	);
	expect(
		rules.map(({ annotations, from, to, source }) => [
			from,
			to,
			annotations.rule?.type,
			annotations.condition?.type,
			source.slice(4),
		]),
	).toEqual([
		[
			"item:A",
			"item:B",
			"enable",
			"count",
			[
				"rules",
				0,
				"when",
				0,
				"query",
				"selector",
				"itemUid",
			],
		],
		[
			"item:A",
			"item:B",
			"disable",
			"count",
			[
				"rules",
				1,
				"when",
				0,
				"query",
				"selector",
				"itemUid",
			],
		],
		[
			"item:A",
			"item:B",
			"disable",
			"exists",
			[
				"rules",
				1,
				"when",
				1,
				"query",
				"selector",
				"itemUid",
			],
		],
		[
			"item:A",
			"item:B",
			"show",
			"exists",
			[
				"rules",
				2,
				"when",
				0,
				"query",
				"selector",
				"itemUid",
			],
		],
		[
			"item:A",
			"item:B",
			"hide",
			"range",
			[
				"rules",
				3,
				"when",
				0,
				"query",
				"selector",
				"itemUid",
			],
		],
		[
			"item:A",
			"item:B",
			"runtime:multiplier",
			"exists",
			[
				"rules",
				4,
				"when",
				0,
				"query",
				"selector",
				"itemUid",
			],
		],
		[
			"item:A",
			"item:B",
			"runtime:adjust",
			"count",
			[
				"rules",
				5,
				"when",
				0,
				"query",
				"selector",
				"itemUid",
			],
		],
	]);
	expect(rules[0]?.annotations.condition).toMatchObject({
		count: 0,
		query: {
			distance: "self",
		},
	});
	expect(rules[4]?.annotations.condition).toMatchObject({
		min: 0,
		max: 3,
		query: {
			distance: "near-close",
		},
	});
	expect(rules[5]?.annotations.rule).toMatchObject({
		multiplier: 0.5,
	});
	expect(rules[6]?.annotations.rule).toMatchObject({
		adjustMs: -42,
	});
	expect(
		facts.edges.filter((edge) => edge.kind === "rule-reference" && edge.source[2] === "clock"),
	).toHaveLength(2);
});

it("retains unresolved authoring references and self output without importing runtime feasibility", () => {
	const facts = compileGraphFactsFn(
		configFn(
			{
				A: itemFn("A", {
					lines: [
						expiryLineFn("A-expiry", outputFn("missing")),
						lineFn("L", {
							trigger: "clock-interval",
							enable: false,
							outcome: outputFn("A"),
							rules: [
								{
									type: "enable",
									when: [
										{
											type: "exists",
											query: queryFn("missing"),
										},
									],
								},
							],
						}),
					],
					clock: {
						intervalMs: 100,
						durationMs: 100,
					},
					merge: [
						{
							action: "use",
							effect: "keep",
							target: {
								type: "item",
								itemUid: "A",
							},
						},
					],
				}),
			},
			{
				start: {
					currentSpace: 99,
					spaces: [
						{
							space: 7,
							templateUid: "missing",
						},
					],
				},
			},
		),
	);
	expect(facts.nodes.filter((node) => node.missing).map((node) => node.id)).toEqual([
		"item:missing",
		"template:missing",
	]);
	expect(facts.edges).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				from: "item:A",
				to: "item:A",
				kind: "line-item-outcome",
			}),
			expect.objectContaining({
				from: "item:A",
				to: "item:A",
				kind: "merge-target",
			}),
			expect.objectContaining({
				from: "item:A",
				to: "item:missing",
				kind: "line-item-outcome",
			}),
			expect.objectContaining({
				from: "start",
				to: "space:99",
				kind: "start-space",
			}),
		]),
	);
});

it("scopes punctuation-containing identities and keeps line relation identity across reorder", () => {
	const a = 'A:line:["L"]';
	const l = "L:outcome:[0]";
	const config = configFn({
		[a]: itemFn(a, {
			lines: [
				lineFn(l, {
					outcome: outputFn("B"),
				}),
				lineFn("second", {
					outcome: outputFn("B"),
				}),
			],
		}),
		B: itemFn("B", {
			lines: [
				lineFn(`B:${l}`, {
					outcome: outputFn(a),
				}),
			],
		}),
	});
	const before = compileGraphFactsFn(config);
	const reordered = configFn({
		...config.items,
		[a]: {
			...config.items[a],
			lines: [
				...config.items[a]!.lines,
			].reverse(),
		},
	});
	const after = compileGraphFactsFn(reordered);
	expect(new Set(before.operations.map((operation) => operation.id)).size).toBe(
		before.operations.length,
	);
	expect(new Set(before.edges.map((edge) => edge.id)).size).toBe(before.edges.length);
	expect(after.edges.map((edge) => edge.id).sort()).toEqual(
		before.edges.map((edge) => edge.id).sort(),
	);
	const original = before.edges.find(
		(edge) => edge.from === `item:${a}` && edge.source[3] === 0,
	)!;
	expect(after.edges.find((edge) => edge.id === original.id)?.source).toEqual([
		"items",
		a,
		"lines",
		1,
		"outcome",
		"set",
		0,
		"roll",
		0,
		"outcome",
		0,
		"itemUid",
	]);
});

it("changing one selector retargets only its occurrence and leaves the earlier snapshot intact", () => {
	const config = configFn({
		A: itemFn("A", {
			lines: [
				lineFn("L", {
					input: [
						{
							type: "materials",
							query: queryFn("B"),
							quantity: {
								min: 1,
								max: 1,
							},
						},
					],
					outcome: outputFn("B"),
				}),
			],
		}),
		B: itemFn("B"),
		C: itemFn("C"),
	});
	const before = compileGraphFactsFn(config);
	const edited = structuredClone(config);
	const input = edited.items.A!.lines[0]!.input[0];
	input.query.selector.itemUid = "C";
	const after = compileGraphFactsFn(edited);
	const changed = before.edges.filter(
		(edge) =>
			JSON.stringify(edge) !==
			JSON.stringify(after.edges.find((other) => other.id === edge.id)),
	);
	expect(changed).toHaveLength(1);
	expect(changed[0]).toMatchObject({
		kind: "line-material",
		from: "item:B",
		to: "item:A",
	});
	expect(after.edges.find((edge) => edge.id === changed[0]!.id)).toMatchObject({
		from: "item:C",
		to: "item:A",
	});
	expect(
		before.edges.find((edge) => edge.kind === "line-material")?.annotations.input,
	).toMatchObject({
		query: {
			selector: {
				itemUid: "B",
			},
		},
	});
});
