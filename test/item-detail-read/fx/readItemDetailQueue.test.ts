import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readItemDetailQueueFx } from "~/item-detail-read/fx/readItemDetailQueueFx";
import { useGameFx } from "~test/support/useGameFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
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
				lineUid: "line:workshop:build",
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
					lineUid: "line:workshop:build",
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
			active: [
				{
					lineUid: "line:workshop:build",
					status: "running",
					jobId: "job:active",
				},
			],
			request: [
				{
					requestId: "job:queued",
					lineUid: "line:workshop:build",
					status: "blocked-active",
				},
			],
		});
	});

	it("projects each idle request independently without changing accepted order or input state", () => {
		const config = structuredClone(lineRunTestConfig);
		const workshop = config.items.workshop;
		workshop.lines.push({
			...workshop.lines[0],
			uid: "line:workshop:ready",
			input: [
				{
					type: "simple",
				},
			],
		});
		const base = queuedRuntime(
			lineRunRuntime({
				permit: true,
				water: 1,
			}),
		);
		const runtime = {
			...base,
			items: base.items.map((item) => ({
				...item,
				item: config.items[item.item.uid],
			})),
			jobQueue: [
				...base.jobQueue,
				{
					id: "job:later",
					ownerItemId: "runtime:workshop",
					lineUid: "line:workshop:ready",
				},
			],
		} satisfies RuntimeSchema.Type;
		const before = structuredClone(runtime);

		expect(
			readQueue(
				{
					itemId: "runtime:workshop",
					runtime,
				},
				config,
			),
		).toMatchObject({
			request: [
				{
					requestId: "job:queued",
					lineUid: "line:workshop:build",
					status: "waiting-inputs",
				},
				{
					requestId: "job:later",
					lineUid: "line:workshop:ready",
					status: "inputs-ready",
				},
			],
		});
		expect(runtime).toEqual(before);
	});

	it("keeps an already queued ready request ready at capacity one and rejects unavailable owners", () => {
		const runtime = lineRunRuntime({
			permit: true,
			water: 3,
		});
		const singleSlotRuntime = {
			...queuedRuntime(runtime),
			items: runtime.items.map((item) =>
				item.id === "runtime:workshop"
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
			active: [],
			request: [
				{
					requestId: "job:queued",
					lineUid: "line:workshop:build",
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

	it("omits active and queued work for a currently hidden line", () => {
		const base = queuedRuntime(lineRunRuntime({}));
		const runtime = {
			...base,
			jobs: [
				{
					id: "job:hidden",
					ownerItemId: "runtime:workshop",
					lineUid: "line:workshop:build",
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
		).toMatchObject({
			kind: "available",
			active: [],
			request: [],
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
					requestId: "job:queued",
					status: "waiting-inputs",
				},
			],
		});

		const spentConfig = structuredClone(lineRunTestConfig);
		const workshop = spentConfig.items.workshop;
		workshop.units = {
			amount: 1,
		};
		workshop.lines[0].input[0].units = {
			cost: 2,
			from: "self",
		};
		const blocked = queuedRuntime({
			...waiting,
			items: waiting.items.map((item) =>
				item.id === "runtime:workshop"
					? {
							...item,
							item: spentConfig.items.workshop,
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
				spentConfig,
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
