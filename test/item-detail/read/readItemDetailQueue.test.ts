import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readItemDetailQueueFx } from "~/engine/item-detail/read/readItemDetailQueueFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { lineRunRuntime, lineRunTestConfig } from "~test/line/fx/run/support/lineRunTestRuntime";

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
			...base,
			jobs: [
				{
					id: "job:active",
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
					durationMs: 1_000,
					remainingMs: 600,
				},
			],
			jobQueue: [
				{
					id: "job:queued",
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
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

	it("is available at capacity one and unavailable only for stale or non-line owners", () => {
		const runtime = lineRunRuntime({
			permit: true,
		});
		const singleSlotRuntime = {
			...runtime,
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
			request: [],
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

		const workshop = lineRunTestConfig.items.workshop;
		if (workshop.type !== "producer") throw new Error("Expected producer fixture.");
		const chargedConfig = GameConfigSchema.parse({
			...lineRunTestConfig,
			items: {
				...lineRunTestConfig.items,
				workshop: {
					...workshop,
					charges: {
						amount: 1,
					},
					lines: workshop.lines.map((line) => ({
						...line,
						input: line.input.map((input, index) =>
							index === 0 && input.type === "materials"
								? {
										...input,
										charges: {
											cost: 2,
											from: "self",
										},
									}
								: input,
						),
					})),
				},
			},
		});
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
});
