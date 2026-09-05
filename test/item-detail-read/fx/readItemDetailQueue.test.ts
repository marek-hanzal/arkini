import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readItemDetailQueueFx } from "~/item-detail-read/fx/readItemDetailQueueFx";
import { useGameFx } from "~test/support/useGameFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createOutput } from "~test/game-config-validation/support/gameValidationTestSource";
import {
	lineRunRuntime,
	lineRunTestConfig,
} from "~test/production-line/support/lineRunTestRuntime";

const run = <A, E>(effect: Effect.Effect<A, E, never>) => Effect.runSync(effect);

const readQueue = (
	props: readItemDetailQueueFx.Props,
	config: GameConfigSchema.Type = lineRunTestConfig,
) =>
	run(
		readItemDetailQueueFx(props).pipe(
			useGameFx({
				config,
			}),
		),
	);

const queuedRuntime = (runtime: RuntimeSchema.Type) =>
	({
		...runtime,
		jobQueue: [
			{
				id: "job:queued",
				ownerItemId: "runtime:workshop",
				lineId: "line:workshop:build",
			},
		],
	}) satisfies RuntimeSchema.Type;

describe("readItemDetailQueue", () => {
	it("projects active work before queued intents", () => {
		const base = lineRunRuntime({
			permit: true,
		});
		const runtime = {
			...queuedRuntime(base),
			jobs: [
				{
					id: "job:active",
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
					durationMs: 1_000,
					remainingMs: 600,
				},
			],
		} satisfies RuntimeSchema.Type;

		expect(
			readQueue({
				itemId: "runtime:workshop",
				runtime,
			}),
		).toEqual({
			kind: "available",
			itemId: "runtime:workshop",
			capacity: 2,
			active: [
				{
					jobId: "job:active",
					lineId: "line:workshop:build",
					title: "Build",
					status: "running",
					durationMs: 1_000,
					remainingMs: 600,
				},
			],
			request: [
				{
					requestId: "job:queued",
					lineId: "line:workshop:build",
					title: "Build",
					status: "blocked-earlier",
				},
			],
		});
	});

	it("keeps an already queued ready head ready at capacity one and rejects unavailable owners", () => {
		const runtime = lineRunRuntime({
			permit: true,
			water: [
				3,
			],
		});
		const singleSlotRuntime = {
			...queuedRuntime(runtime),
			items: runtime.items.map((item) =>
				item.id === "runtime:workshop" && item.item.type === "producer"
					? {
							...item,
							item: {
								...item.item,
								maxQueueSize: 1,
							},
						}
					: item,
			),
		} satisfies RuntimeSchema.Type;
		expect(
			readQueue({
				itemId: "runtime:workshop",
				runtime: singleSlotRuntime,
			}),
		).toEqual({
			kind: "available",
			itemId: "runtime:workshop",
			capacity: 1,
			active: [],
			request: [
				{
					requestId: "job:queued",
					lineId: "line:workshop:build",
					title: "Build",
					status: "inputs-ready",
				},
			],
		});
		expect(
			readQueue({
				itemId: "runtime:missing",
				runtime,
			}),
		).toEqual({
			kind: "unavailable",
		});
		expect(
			readQueue({
				itemId: "runtime:permit",
				runtime,
			}),
		).toEqual({
			kind: "unavailable",
		});
	});

	it("reports missing material as a wait only while every hard queue condition still holds", () => {
		const waiting = queuedRuntime(
			lineRunRuntime({
				permit: true,
			}),
		);
		expect(
			readQueue({
				itemId: "runtime:workshop",
				runtime: waiting,
			}),
		).toMatchObject({
			request: [
				{
					missingQuantity: 3,
					requestId: "job:queued",
					status: "waiting-inputs",
				},
			],
		});

		const chargedConfig = structuredClone(lineRunTestConfig);
		const workshop = chargedConfig.items.workshop;
		if (workshop.type !== "producer") throw new Error("Expected producer fixture.");
		workshop.charges = {
			amount: 1,
		};
		workshop.lines[0].input[0].charges = {
			cost: 2,
			from: "self",
		};
		const blocked = queuedRuntime({
			...waiting,
			items: waiting.items.map((item) =>
				item.id === "runtime:workshop"
					? {
							...item,
							item: chargedConfig.items.workshop,
						}
					: item,
			),
		});
		expect(
			readQueue(
				{
					itemId: "runtime:workshop",
					runtime: blocked,
				},
				chargedConfig,
			),
		).toMatchObject({
			request: [
				{
					requestId: "job:queued",
					status: "blocked-condition",
				},
			],
		});
	});

	it("blocks a material-ready head at the output cap without reporting missing inputs", () => {
		const config = structuredClone(lineRunTestConfig);
		config.items.permit.maxCount = 1;
		const workshop = config.items.workshop;
		if (workshop.type !== "producer") throw new Error("Expected producer fixture.");
		workshop.lines[0].output = createOutput([
			{
				itemId: "permit",
			},
		]);
		const base = queuedRuntime(
			lineRunRuntime({
				permit: true,
				water: [
					3,
				],
			}),
		);
		const result = readQueue(
			{
				itemId: "runtime:workshop",
				runtime: {
					...base,
					items: base.items.map((item) => ({
						...item,
						item: config.items[item.item.id],
					})),
				},
			},
			config,
		);
		if (result.kind !== "available") throw new Error("Expected an available queue.");
		expect(result.request).toEqual([
			{
				requestId: "job:queued",
				lineId: "line:workshop:build",
				title: "Build",
				outputItemId: "permit",
				status: "blocked-condition",
			},
		]);
	});
});
