import { Clock, Effect } from "effect";
import { expect, it } from "vitest";
import { compileGraphFactsFn } from "~/graph/fn/compileGraphFactsFn";
import { compileGraphOperationIndexFn } from "~/graph/fn/compileGraphOperationIndexFn";
import { queryGraphFlowFx } from "~/graph/fx/queryGraphFlowFx";
import { GraphFlowQuerySchema } from "~/graph/schema/GraphFlowQuerySchema";
import type { GraphOperationIndex } from "~/graph/type/GraphOperationIndex";
import {
	configFn,
	expiryLineFn,
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
	index: GraphOperationIndex,
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
	const index = compileGraphOperationIndexFn(compileGraphFactsFn(config));
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
			participants: [
				"item:factory",
				"item:raw",
			],
		},
	});
	const produced = await readFn(index, "item:factory", "item:product");
	expect(produced.flows[0].steps[0].evidence.participants).toEqual([
		"item:factory",
		"item:fuel",
	]);
	expect(
		produced.flows[0].steps[0].evidence.facts.some((note) => note.includes("item:marker")),
	).toBe(true);
});

it("follows merge replacement, expiry and depletion through exact operations", async () => {
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
			lines: [
				expiryLineFn("lit-expiry", outputFn("ash")),
			],
			clock: {
				durationMs: 1000,
			},
		}),
		ash: itemFn("ash"),
		battery: itemFn("battery", {
			units: {
				amount: 3,
			},
			lines: [
				expiryLineFn("battery-depletion", outputFn("ash")),
			],
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
	const index = compileGraphOperationIndexFn(compileGraphFactsFn(config));
	const result = await readFn(index, "item:unlit", "item:ash");
	expect(result.flows[0].nodes).toEqual([
		"item:unlit",
		"item:lit",
		"item:ash",
	]);
	expect(result.flows[0].steps.map((step) => step.kind)).toEqual([
		"merge",
		"line",
	]);
	expect(result.flows[0].steps[0].evidence).toMatchObject({
		fromRole: "target",
		output: "replacement",
		participants: [
			"item:match",
			"item:unlit",
		],
	});
	expect((await readFn(index, "item:match", "item:lit")).status).toBe("yes");
	expect((await readFn(index, "item:lit", "item:unlit")).status).toBe("no");
	expect((await readFn(index, "item:battery", "item:ash")).flows[0].steps[0].kind).toBe("line");
	// Transport moves an unspecified incoming instance; it never converts the receiver into that space.
	expect((await readFn(index, "item:portal", "space:9")).status).toBe("no");
	expect((await readFn(index, "item:unlit", "space:9")).status).toBe("no");
});

it("keeps disabled, zero-chance, missing and parallel authored output occurrences discoverable", async () => {
	const chanceFn = (chance: number) => ({
		...outputFn("B").set[0].roll[0],
		type: "chance",
		chance,
	});
	const config = configFn({
		A: itemFn("A", {
			lines: [
				expiryLineFn("A-expiry", outputFn("B")),
				lineFn("disabled", {
					enable: false,
					outcome: outputFn("missing"),
				}),
				lineFn("parallel", {
					outcome: {
						set: [
							{
								rules: [],
								roll: [
									chanceFn(0),
									chanceFn(0.25),
								],
							},
						],
					},
				}),
			],
			clock: {
				intervalMs: 1000,
				durationMs: 1000,
			},
		}),
		B: itemFn("B"),
	});
	const index = compileGraphOperationIndexFn(compileGraphFactsFn(config));
	expect((await readFn(index, "item:A", "item:missing")).status).toBe("yes");
	const result = await readFn(index, "item:A", "item:B");
	expect(result.flows).toHaveLength(3);
	expect(
		result.flows.filter((flow) => flow.steps[0].operationId === '["line","parallel"]'),
	).toHaveLength(2);
	// Returned projections must not retain aliases into the reusable snapshot.
	(result.flows[0].steps[0].evidence.participants as string[]).push("corrupted");
	expect(
		(await readFn(index, "item:A", "item:B")).flows[0].steps[0].evidence.participants,
	).not.toContain("corrupted");
	await expect(readFn(index, "item:unknown", "item:B")).rejects.toMatchObject({
		reason: "missing-node",
	});
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
	const index = compileGraphOperationIndexFn(compileGraphFactsFn(config));
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
