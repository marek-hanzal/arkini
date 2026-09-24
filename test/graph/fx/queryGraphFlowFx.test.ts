import { Clock, Effect } from "effect";
import { expect, it } from "vitest";
import { compileGraphFactsFn } from "~/graph/fn/compileGraphFactsFn";
import { compileGraphFlowFn } from "~/graph/fn/compileGraphFlowFn";
import { queryGraphFlowFx } from "~/graph/fx/queryGraphFlowFx";
import { GraphFlowQuerySchema } from "~/graph/schema/GraphFlowQuerySchema";
import type { GraphFlowIndex } from "~/graph/type/GraphFlow";
import {
	configFn,
	itemFn,
	lineFn,
	outputFn,
	queryFn,
} from "../fn/compileGraphFactsFn.test/fixtures";

const materialFn = (itemUid: string) => ({
	type: "materials",
	query: queryFn(itemUid),
	mode: "consume",
	quantity: {
		min: 1,
		max: 1,
	},
});
const readFn = (
	index: GraphFlowIndex,
	from: string,
	to: string,
	options: Record<string, unknown> = {},
) =>
	Effect.runPromise(
		queryGraphFlowFx(
			index,
			GraphFlowQuerySchema.parse({
				from,
				to,
				...options,
			}),
		),
	);

it("keeps each production input bound to its own outputs and never follows owners, rules or reverse edges", async () => {
	const config = configFn({
		factory: itemFn("factory", {
			lines: [
				lineFn("recycle", {
					input: [
						materialFn("raw"),
					],
					outcome: outputFn("scrap"),
				}),
				lineFn("smelt", {
					input: [
						materialFn("fuel"),
					],
					outcome: outputFn("product"),
					rules: [
						{
							type: "enable",
							when: [
								{
									type: "exists",
									query: queryFn("marker"),
								},
							],
						},
					],
				}),
			],
		}),
		raw: itemFn("raw"),
		scrap: itemFn("scrap"),
		fuel: itemFn("fuel"),
		product: itemFn("product"),
		marker: itemFn("marker"),
	});
	const index = compileGraphFlowFn(compileGraphFactsFn(config));
	for (const [from, to] of [
		[
			"raw",
			"product",
		],
		[
			"raw",
			"factory",
		],
		[
			"marker",
			"product",
		],
		[
			"product",
			"fuel",
		],
	])
		expect(await readFn(index, `item:${from}`, `item:${to}`)).toMatchObject({
			status: "no",
			truncated: false,
			flows: [],
		});
	const consumed = await readFn(index, "item:raw", "item:scrap");
	expect(consumed.flows[0].steps).toHaveLength(1);
	expect(consumed.flows[0].steps[0]).toMatchObject({
		operationId: '["line","recycle"]',
		evidence: {
			fromRole: "input",
			prerequisiteNodes: [
				"item:factory",
			],
		},
	});
	const produced = await readFn(index, "item:factory", "item:product");
	expect(produced.flows[0].steps[0].evidence.prerequisiteNodes).toEqual([
		"item:fuel",
	]);
	expect(
		produced.flows[0].steps[0].evidence.prerequisites.some((note) => note.includes("rules")),
	).toBe(true);
});

it("follows merge replacement and expiry as atomic state changes with the other participant retained", async () => {
	const config = configFn({
		match: itemFn("match", {
			merge: [
				{
					action: "consume",
					effect: "replace",
					target: {
						type: "item",
						itemUid: "unlit",
					},
					result: "lit",
				},
			],
		}),
		unlit: itemFn("unlit"),
		lit: itemFn("lit", {
			clock: {
				durationMs: 1000,
				onExpire: outputFn("ash"),
			},
		}),
		ash: itemFn("ash"),
		battery: itemFn("battery", {
			units: {
				amount: 3,
				outcome: outputFn("ash"),
			},
		}),
		portal: itemFn("portal", {
			merge: [
				{
					action: "space",
					space: 9,
					effect: "replace",
					result: "ash",
				},
			],
		}),
	});
	const index = compileGraphFlowFn(compileGraphFactsFn(config));
	const result = await readFn(index, "item:unlit", "item:ash");
	expect(result.flows[0].nodes).toEqual([
		"item:unlit",
		"item:lit",
		"item:ash",
	]);
	expect(result.flows[0].steps.map((step) => step.kind)).toEqual([
		"merge",
		"clock",
	]);
	expect(result.flows[0].steps[0].evidence).toMatchObject({
		fromRole: "target",
		output: "replacement",
		prerequisiteNodes: [
			"item:match",
		],
	});
	expect((await readFn(index, "item:match", "item:lit")).status).toBe("yes");
	expect((await readFn(index, "item:lit", "item:unlit")).status).toBe("no");
	expect((await readFn(index, "item:battery", "item:ash")).flows[0].steps[0].kind).toBe(
		"depletion",
	);
	// Transport moves an unspecified incoming instance; it never converts the receiver into that space.
	expect((await readFn(index, "item:portal", "space:9")).status).toBe("no");
	expect((await readFn(index, "item:unlit", "space:9")).status).toBe("no");
	expect(
		(
			await readFn(index, "item:portal", "item:ash")
		).flows[0].steps[0].evidence.prerequisites.join(" "),
	).toContain("unspecified identity");
});

it("excludes statically impossible outcomes while retaining conditional alternatives as separate evidence", async () => {
	const chanceFn = (chance: number) => ({
		...outputFn("B").set[0].roll[0],
		type: "chance",
		chance,
	});
	const conditional = [
		{
			type: "enable",
			when: [
				{
					type: "exists",
					query: queryFn("C"),
				},
			],
		},
	];
	const config = configFn({
		A: itemFn("A", {
			lines: [
				lineFn("disabled", {
					enable: false,
					outcome: outputFn("D"),
				}),
				lineFn("conditional", {
					enable: false,
					rules: conditional,
					outcome: {
						set: [
							{
								rules: [],
								roll: [
									chanceFn(0),
								],
							},
							{
								rules: [],
								roll: [
									chanceFn(0.25),
								],
							},
							{
								rules: conditional,
								roll: [
									chanceFn(0.75),
								],
							},
						],
					},
				}),
			],
			clock: {
				intervalMs: 1000,
				onExpire: outputFn("D"),
			},
		}),
		B: itemFn("B"),
		C: itemFn("C"),
		D: itemFn("D"),
	});
	const index = compileGraphFlowFn(compileGraphFactsFn(config));
	expect((await readFn(index, "item:A", "item:D")).status).toBe("no");
	const result = await readFn(index, "item:A", "item:B");
	expect(result.flows.map((flow) => flow.steps[0].evidence.chance)).toEqual([
		0.25,
		0.75,
	]);
	expect(result.flows.every((flow) => flow.steps[0].evidence.alternative)).toBe(true);
	expect((await readFn(index, "item:C", "item:B")).status).toBe("no");
	// Returned evidence cannot mutate the snapshot used by subsequent readers.
	(result.flows[0].steps[0].evidence.prerequisiteNodes as string[]).push("corrupted");
	expect(
		(await readFn(index, "item:A", "item:B")).flows[0].steps[0].evidence.prerequisiteNodes,
	).not.toContain("corrupted");
});

it("reports incomplete absence and omitted alternatives under operation depth, expansion and result budgets", async () => {
	const config = configFn({
		A: itemFn("A", {
			lines: [
				lineFn("ab", {
					outcome: outputFn("B"),
				}),
				lineFn("ab2", {
					outcome: outputFn("B"),
				}),
			],
		}),
		B: itemFn("B", {
			lines: [
				lineFn("bc", {
					outcome: outputFn("C"),
				}),
			],
		}),
		C: itemFn("C"),
	});
	const index = compileGraphFlowFn(compileGraphFactsFn(config));
	expect(
		await readFn(index, "item:A", "item:C", {
			maxDepth: 1,
		}),
	).toMatchObject({
		status: "unknown",
		truncated: true,
		reasons: [
			"depth",
		],
		flows: [],
	});
	expect(
		await readFn(index, "item:A", "item:C", {
			maxExpansions: 1,
		}),
	).toMatchObject({
		status: "unknown",
		truncated: true,
		reasons: [
			"expansions",
		],
	});
	expect(
		await readFn(index, "item:A", "item:C", {
			limit: 1,
		}),
	).toMatchObject({
		status: "yes",
		truncated: true,
		reasons: [
			"limit",
		],
	});
	expect(
		(
			await readFn(index, "item:A", "item:C", {
				operationKinds: [
					"merge",
				],
			})
		).status,
	).toBe("no");
	const timed = await Effect.runPromise(
		Effect.gen(function* () {
			const clock = yield* Clock.Clock;
			let reads = 0;
			return yield* queryGraphFlowFx(
				index,
				GraphFlowQuerySchema.parse({
					from: "item:A",
					to: "item:C",
					timeoutMs: 1,
				}),
			).pipe(
				Effect.provideService(Clock.Clock, {
					currentTimeMillis: Effect.sync(() => reads++ * 2),
					currentTimeMillisUnsafe: () => reads++ * 2,
					currentTimeNanos: clock.currentTimeNanos,
					currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
					monotonicTimeNanos: clock.monotonicTimeNanos,
					monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
					sleep: (duration) => clock.sleep(duration),
				}),
			);
		}),
	);
	expect(timed).toMatchObject({
		status: "unknown",
		truncated: true,
		reasons: [
			"timeout",
		],
		expansions: 0,
	});
});
