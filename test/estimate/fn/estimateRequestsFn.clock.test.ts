import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { estimateRequestsFn } from "~/estimate/fn/estimateRequestsFn";
import { createAcquisitionGraphFn } from "~/flow/fn/createAcquisitionGraphFn";
import { readItemOriginSourcesFn } from "~/flow/fn/readItemOriginSourcesFn";
import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import {
	createLine,
	createOutput,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";

const createClockGraph = async ({
	durationMs,
	enable = true,
	ui = "simple",
	runtimeMs = 300,
	once = false,
	passive = false,
	additionalLines = [],
}: {
	durationMs?: number;
	enable?: boolean;
	ui?: "simple" | "default";
	runtimeMs?: number;
	once?: boolean;
	passive?: boolean;
	additionalLines?: ReadonlyArray<LineSchema.Type>;
} = {}) => {
	const clock = ItemSchema.parse({
		...createProducerItem({
			id: "clock",
			lines: passive
				? []
				: [
						{
							...createLine({
								id: "default",
								default: false,
								clock: true,
								output: createOutput([
									{
										itemId: "target",
									},
								]),
							}),
							runtimeMs,
						},
						createLine({
							id: "manual",
							default: true,
							output: createOutput([
								{
									itemId: "other",
								},
							]),
						}),
						...additionalLines,
					],
		}),
		maxStackSize: 1,
		ui,
		clock: {
			intervalMs: once ? undefined : 1000,
			durationMs,
			enable,
			onExpire: createOutput([
				{
					itemId: "expired",
				},
			]),
		},
	});
	const result = await Effect.runPromise(
		compileGameSourcesFx([
			createRootSource({
				items: {
					clock,
					target: createSimpleItem("target"),
					other: createSimpleItem("other"),
					expired: createSimpleItem("expired"),
				},
				start: {
					currentSpace: 0,
					board: [
						{
							itemId: "clock",
							x: 0,
							y: 0,
							space: 0,
							quantity: 1,
						},
					],
				},
			}),
		]),
	);
	expect(result.diagnostics).toEqual([]);
	if (result.config === undefined) throw new Error("Expected a valid Clock fixture.");
	return createAcquisitionGraphFn(result.config);
};

describe("Clock authored acquisition boundaries", () => {
	it("keeps one-shot expiry fully estimable when the owner has no production to drain", async () => {
		const graph = await createClockGraph({
			durationMs: 2000,
			once: true,
			passive: true,
		});
		expect(
			estimateRequestsFn({
				graph,
				requests: [
					{
						factId: "expired",
					},
				],
			})[0],
		).toMatchObject({
			status: "complete",
			durationMs: 2000,
		});
		const disabled = await createClockGraph({
			durationMs: 2000,
			once: true,
			passive: true,
			enable: false,
		});
		expect(
			estimateRequestsFn({
				graph: disabled,
				requests: [
					{
						factId: "expired",
					},
				],
			})[0],
		).toMatchObject({
			status: "unreachable",
		});
	});

	it("does not invent automatic production pulses for a lifetime-only owner", async () => {
		const graph = await createClockGraph({
			durationMs: 2000,
			once: true,
		});
		expect(
			estimateRequestsFn({
				graph,
				requests: [
					{
						factId: "target",
					},
				],
			})[0],
		).toMatchObject({
			status: "unreachable",
		});
	});

	it("keeps ordinary lines and expiry in Flow while finite capacity and settlement stay indeterminate", async () => {
		const graph = await createClockGraph({
			durationMs: 2000,
		});
		const sources = readItemOriginSourcesFn(graph);
		expect(
			sources.map(({ kind, reference }) => ({
				kind,
				reference,
			})),
		).toEqual(
			expect.arrayContaining([
				{
					kind: "line",
					reference: {
						type: "line",
						lineId: "default",
					},
				},
				{
					kind: "line",
					reference: {
						type: "line",
						lineId: "manual",
					},
				},
				{
					kind: "expiry",
					reference: {
						type: "expiry",
					},
				},
			]),
		);
		const estimates = estimateRequestsFn({
			graph,
			requests: [
				{
					factId: "target",
					quantity: 100,
				},
				{
					factId: "expired",
				},
			],
		});
		for (const estimate of estimates) {
			expect(estimate.status).toBe("partial");
			expect(estimate.diagnostics).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						kind: "finite-owner-lifetime-unsupported",
					}),
				]),
			);
		}
	});

	it("bounds automatic throughput while allowing the authored default line manually", async () => {
		const graph = await createClockGraph();
		const [target, other, expired] = estimateRequestsFn({
			graph,
			requests: [
				{
					factId: "target",
					quantity: 3,
				},
				{
					factId: "other",
				},
				{
					factId: "expired",
				},
			],
		});
		expect(target).toMatchObject({
			status: "complete",
			durationMs: 3000,
		});
		expect(other).toMatchObject({
			status: "complete",
		});
		expect(expired).toMatchObject({
			status: "unreachable",
		});
		expect(
			graph.routes.find(
				({ metadata }) => metadata.kind === "line-output" && metadata.lineId === "default",
			)?.durationMs,
		).toBe(300);
	});

	it("excludes permanently disabled Clock lines from the automatic pool", async () => {
		const graph = await createClockGraph({
			additionalLines: [
				{
					...createLine({
						id: "disabled",
						clock: true,
					}),
					clockWeight: 999,
					enable: false,
				},
			],
		});
		expect(
			estimateRequestsFn({
				graph,
				requests: [
					{
						factId: "target",
						quantity: 2,
					},
				],
			})[0],
		).toMatchObject({
			status: "complete",
			durationMs: 2000,
		});
	});

	it.each([
		"target",
		"other",
	])("does not assign independent timing to weighted Clock output %s", async (itemId) => {
		const graph = await createClockGraph({
			additionalLines: [
				{
					...createLine({
						id: "competing",
						clock: true,
						output: createOutput([
							{
								itemId,
							},
						]),
					}),
					clockWeight: 3,
					show: false,
				},
			],
		});
		expect(
			estimateRequestsFn({
				graph,
				requests: [
					{
						factId: "target",
					},
				],
			})[0],
		).toMatchObject({
			status: "partial",
			diagnostics: expect.arrayContaining([
				expect.objectContaining({
					kind: "weighted-clock-pool-unsupported",
				}),
			]),
		});
	});

	it("keeps conditional weighted eligibility indeterminate rather than inventing fixed odds", async () => {
		const graph = await createClockGraph({
			additionalLines: [
				{
					...createLine({
						id: "competing",
						clock: true,
					}),
					clockWeight: 3,
					rules: [
						{
							type: "disable",
							when: [
								{
									type: "exists",
									query: {
										distance: "universe",
										selector: {
											type: "item",
											itemId: "target",
										},
									},
								},
							],
						},
					],
				},
			],
		});
		expect(
			estimateRequestsFn({
				graph,
				requests: [
					{
						factId: "target",
					},
				],
			})[0],
		).toMatchObject({
			status: "partial",
			diagnostics: expect.arrayContaining([
				expect.objectContaining({
					kind: "weighted-clock-pool-unsupported",
				}),
			]),
		});
	});

	it("retains production runtime when it exceeds cadence and permits interactive manual lines with the timer disabled", async () => {
		const automatic = await createClockGraph({
			runtimeMs: 1500,
		});
		expect(
			estimateRequestsFn({
				graph: automatic,
				requests: [
					{
						factId: "target",
						quantity: 3,
					},
				],
			})[0],
		).toMatchObject({
			status: "complete",
			durationMs: 4500,
		});
		const disabled = await createClockGraph({
			enable: false,
		});
		expect(
			estimateRequestsFn({
				graph: disabled,
				requests: [
					{
						factId: "target",
					},
				],
			})[0],
		).toMatchObject({
			status: "unreachable",
		});
		const interactive = await createClockGraph({
			enable: false,
			ui: "default",
		});
		expect(
			estimateRequestsFn({
				graph: interactive,
				requests: [
					{
						factId: "target",
						quantity: 3,
					},
					{
						factId: "other",
					},
				],
			}),
		).toMatchObject([
			{
				status: "complete",
				durationMs: 900,
			},
			{
				status: "complete",
				durationMs: 0,
			},
		]);
	});
});
