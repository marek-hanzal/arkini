import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorAcquisitionGraphFx } from "~/editor/createEditorAcquisitionGraphFx";
import { estimateEditorItemFx } from "~/editor/estimator/estimateEditorItemFx";
import { compileGameSourcesFx } from "~/engine/compiler/fx/compileGameSourcesFx";
import { resolveLineRunFx } from "~/engine/line/fx/run/resolveLineRunFx";
import { createMergeTestConfig } from "~test/merge/support/createMergeTestConfig";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";
import {
	createLine,
	createOutput,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";

describe("createEditorAcquisitionGraphFx", () => {
	it("only projects charge depletion after an exact number of authored spends", async () => {
		const config = structuredClone(await readArkiniGameConfigSource());
		const tree = config.items["item:tree"];
		const lumberjack = config.items["producer:lumberjack-t1"];
		if (tree?.charges === undefined || lumberjack?.type !== "producer")
			throw new Error("Official charge fixture is missing.");
		const line = lumberjack.lines?.find(({ id }) => id === "line:lumberjack-t1:log");
		const deposit = line?.input.find(({ type }) => type === "deposit");
		if (line === undefined || deposit?.charges === undefined)
			throw new Error("Official charged line fixture is missing.");
		tree.charges.amount = 3;
		deposit.charges.cost = 2;

		const nonDivisible = Effect.runSync(createEditorAcquisitionGraphFx(config));
		expect(
			nonDivisible.routes.some(
				(route) =>
					route.metadata.kind === "line-charge-depletion" &&
					route.metadata.lineId === line.id &&
					route.metadata.chargedItemId === tree.id,
			),
		).toBe(false);
		const threeRuns = Effect.runSync(
			estimateEditorItemFx({
				factId: "item:log",
				graph: nonDivisible,
				quantity: 3,
			}),
		);
		expect(threeRuns).toMatchObject({
			obtainable: true,
		});
		if (!threeRuns.obtainable) throw new Error("Expected optimistic charged route.");
		expect(threeRuns.route.requirements).toContainEqual(
			expect.objectContaining({
				factId: tree.id,
				quantity: 1,
				usage: "one-time",
			}),
		);

		tree.charges.amount = 4;
		const divisible = Effect.runSync(createEditorAcquisitionGraphFx(config));
		expect(divisible.routes).toContainEqual(
			expect.objectContaining({
				metadata: expect.objectContaining({
					chargedItemId: tree.id,
					kind: "line-charge-depletion",
					lineId: line.id,
				}),
				runMultiplier: 2,
				requirements: expect.objectContaining({
					allOf: expect.arrayContaining([
						expect.objectContaining({
							factId: tree.id,
							quantity: 1,
							usage: "consume",
						}),
					]),
				}),
			}),
		);
	});

	it("marks both roles of a self-merge as distinct live identities", () => {
		const config = createMergeTestConfig({
			rule: {
				action: "use",
				effect: "keep",
				output: createOutput([
					{
						itemId: "result",
					},
				]),
				target: {
					itemId: "source",
					type: "item",
				},
			},
			sourceMaxCount: 2,
		});
		const graph = Effect.runSync(createEditorAcquisitionGraphFx(config));
		const selfMerge = graph.routes.find(
			(route) =>
				route.metadata.kind === "merge-output" &&
				route.metadata.sourceItemId === "source" &&
				route.metadata.targetItemId === "source",
		);

		expect(selfMerge?.requirements.allOf).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					factId: "source",
					identity: "distinct",
					source: "merge-source",
				}),
				expect.objectContaining({
					factId: "source",
					identity: "distinct",
					source: "merge-target",
				}),
			]),
		);
	});

	it("keeps a validator-valid route whose same canonical payer uses two identities", async () => {
		const chargedDeposit = (itemId: string) => ({
			charges: {
				cost: 1,
				from: "target" as const,
			},
			query: {
				distance: "close" as const,
				scope: "board" as const,
				selector: {
					itemId,
					type: "item" as const,
				},
			},
			type: "deposit" as const,
		});
		const producer = createProducerItem({
			id: "producer",
			lines: [
				createLine({
					id: "line:producer:target",
					input: [
						chargedDeposit("payer"),
						chargedDeposit("payer"),
					],
					output: createOutput([
						{
							itemId: "target",
						},
					]),
				}),
			],
		});
		const payer = {
			...createSimpleItem("payer"),
			charges: {
				amount: 1,
			},
			maxCount: 2,
			scope: "board" as const,
		};
		const result = await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items: {
						payer,
						producer,
						target: createSimpleItem("target"),
					},
				}),
			]),
		);
		expect(result.diagnostics).toEqual([]);
		if (result.config === undefined) throw new Error("Expected validator-valid config.");

		const graph = Effect.runSync(createEditorAcquisitionGraphFx(result.config));
		const route = graph.routes.find(({ output }) => output.factId === "target");
		expect(route).toMatchObject({
			chargeUses: [
				{
					accounting: "multi-payer-unsupported",
					payerFactId: "payer",
					usableActionRuns: 0,
				},
			],
			operation: {
				inputs: [
					{
						factId: "payer",
					},
					{
						factId: "payer",
					},
				],
			},
		});

		const owner = {
			id: "runtime:producer",
			item: result.config.items.producer,
			location: {
				position: {
					x: 1,
					y: 0,
				},
				scope: "board" as const,
				space: 0,
			},
			quantity: 1,
			revision: "revision:producer",
		};
		const runtimePayer = (id: string, x: number) => ({
			id,
			item: result.config!.items.payer,
			location: {
				position: {
					x,
					y: 0,
				},
				scope: "board" as const,
				space: 0,
			},
			quantity: 1,
			revision: `revision:${id}`,
		});
		const run = Effect.runSync(
			resolveLineRunFx({
				lineId: "line:producer:target",
				ownerItemId: owner.id,
				runtime: {
					cheats: {
						enabled: false,
						everEnabled: false,
						instantGameplay: false,
					},
					currentSpace: 0,
					items: [
						owner,
						runtimePayer("runtime:payer:a", 0),
						runtimePayer("runtime:payer:b", 2),
					],
					jobs: [],

					jobQueue: [],
					defaultLineByOwnerItemId: {},
				},
			}),
		);
		expect(run).toMatchObject({
			input: [
				{
					plan: {
						charges: {
							itemId: "runtime:payer:a",
						},
					},
				},
				{
					plan: {
						charges: {
							itemId: "runtime:payer:b",
						},
					},
				},
			],
			ready: true,
		});
	});

	it("surfaces authored runtime rules that static duration does not evaluate", async () => {
		const config = structuredClone(await readArkiniGameConfigSource());
		const lumberjack = config.items["producer:lumberjack-t1"];
		if (lumberjack?.type !== "producer" || lumberjack.lines === undefined)
			throw new Error("Official line fixture is missing.");
		lumberjack.lines[0]?.rules.push({
			multiplier: 2,
			type: "runtime:multiplier",
			when: [
				{
					query: {
						distance: "close",
						scope: "board",
						selector: {
							itemId: "item:tree",
							type: "item",
						},
					},
					type: "exists",
				},
			],
		});

		const graph = Effect.runSync(createEditorAcquisitionGraphFx(config));
		expect(graph.limitations).toContain("conditional-runtime-adjustments-ignored");
	});
});
