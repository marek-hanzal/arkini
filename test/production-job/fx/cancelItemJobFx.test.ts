import { Effect, Exit } from "effect";
import { expect, it } from "vitest";

import { cancelItemJobFx } from "~/production-job/fx/cancelItemJobFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import { useGameFx } from "~test/support/useGameFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";
import {
	clearItemJobQueueConfig,
	clearItemJobQueueState,
} from "~test/production-job/fx/clearItemJobQueueFx.test/fixture";

it("cancels exact active work without refunding consumed material or cancelling pending intent", () => {
	Effect.runSync(
		Effect.gen(function* () {
			const owner = yield* prepareJobLineFx();
			yield* enqueueLineFx({
				ownerItemId: owner.id,
				lineId: "line:forge:run",
			});
			yield* runTickRuntimeByFx({
				elapsedMs: 100,
			});
			yield* enqueueLineFx({
				ownerItemId: owner.id,
				lineId: "line:forge:run",
			});
			const before = yield* readRuntimeFx();
			const job = before.jobs[0];
			expect(job).toBeDefined();
			const consumed = before.items.filter((item) => item.location.scope === "job");
			expect(consumed.reduce((sum, item) => sum + item.quantity, 0)).toBe(3);
			yield* cancelItemJobFx({
				ownerItemId: owner.id,
				jobId: job.id,
			});
			const after = yield* readRuntimeFx();
			expect(after.jobs).toHaveLength(0);
			expect(after.jobQueue).toEqual(before.jobQueue);
			expect(
				after.items
					.filter((item) => item.item.id === "water")
					.reduce((sum, item) => sum + item.quantity, 0),
			).toBe(3);
			expect(
				after.items
					.filter((item) => item.item.id === "tool")
					.reduce((sum, item) => sum + item.quantity, 0),
			).toBe(2);
			expect(
				after.items.some(
					(item) => item.location.scope === "job" || item.location.scope === "reserved",
				),
			).toBe(false);
			const transition = yield* (yield* CommittedTransitionsFx).read;
			expect(transition.events).toContainEqual({
				type: "job:aborted",
				jobId: job.id,
				ownerItemId: owner.id,
				lineId: job.lineId,
				reason: "player-cancelled",
			});
			expect(transition.events.some((event) => event.type === "job:completed")).toBe(false);
		}).pipe(
			useGameFx({
				config: createJobTestConfig(3),
			}),
		),
	);
});

it("ignores stale or foreign job identities instead of cancelling another active job", () => {
	Effect.runSync(
		Effect.gen(function* () {
			const before = yield* readRuntimeFx();
			yield* cancelItemJobFx({
				ownerItemId: "runtime:forge:primary",
				jobId: "already-completed",
			});
			yield* cancelItemJobFx({
				ownerItemId: "runtime:forge:other",
				jobId: "job:active",
			});
			expect(yield* readRuntimeFx()).toEqual(before);
		}).pipe(
			useGameFx({
				config: clearItemJobQueueConfig,
				state: clearItemJobQueueState,
			}),
		),
	);
});

it("preserves active work and its materials when a reservation cannot be returned", () => {
	const config = GameConfigSchema.parse({
		...clearItemJobQueueConfig,
		meta: {
			...clearItemJobQueueConfig.meta,
			board: {
				width: 1,
				height: 1,
			},
		},
		items: {
			...clearItemJobQueueConfig.items,
			tool: {
				...clearItemJobQueueConfig.items.tool,
				scope: "board",
			},
		},
	});
	const state: StateSchema.Type = {
		...clearItemJobQueueState,
		items: [
			clearItemJobQueueState.items[0],
			{
				id: "consumed",
				itemId: "water",
				quantity: 3,
				location: {
					scope: "job",
					jobId: "job:active",
					inputIndex: 0,
				},
			},
			{
				id: "reserved",
				itemId: "tool",
				quantity: 1,
				location: {
					scope: "reserved",
					jobId: "job:active",
					inputIndex: 1,
				},
			},
		],
		jobQueue: clearItemJobQueueState.jobQueue.filter(
			(request) => request.ownerItemId === "runtime:forge:primary",
		),
	};
	Effect.runSync(
		Effect.gen(function* () {
			const before = yield* readRuntimeFx();
			const result = yield* Effect.exit(
				cancelItemJobFx({
					ownerItemId: "runtime:forge:primary",
					jobId: "job:active",
				}),
			);
			expect(Exit.isFailure(result)).toBe(true);
			expect(yield* readRuntimeFx()).toEqual(before);
		}).pipe(
			useGameFx({
				config,
				state,
			}),
		),
	);
});

it("enforces player control and does not refund units spent at start", () => {
	const config = GameConfigSchema.parse({
		...clearItemJobQueueConfig,
		items: {
			...clearItemJobQueueConfig.items,
			forge: {
				...clearItemJobQueueConfig.items.forge,
				units: {
					amount: 2,
				},
			},
		},
	});
	const state = {
		...clearItemJobQueueState,
		items: clearItemJobQueueState.items.map((item) => ({
			...item,
			remainingUnits: 1,
		})),
	};
	Effect.runSync(
		Effect.gen(function* () {
			yield* cancelItemJobFx({
				ownerItemId: "runtime:forge:primary",
				jobId: "job:active",
			});
			expect(
				(yield* readRuntimeFx()).items.find((item) => item.id === "runtime:forge:primary")
					?.remainingUnits,
			).toBe(1);
		}).pipe(
			useGameFx({
				config,
				state,
			}),
		),
	);
	const automatic = GameConfigSchema.parse({
		...config,
		items: {
			...config.items,
			forge: {
				...config.items.forge,
				ui: "simple",
			},
		},
	});
	Effect.runSync(
		Effect.gen(function* () {
			const before = yield* readRuntimeFx();
			const result = yield* Effect.exit(
				cancelItemJobFx({
					ownerItemId: "runtime:forge:primary",
					jobId: "job:active",
				}),
			);
			expect(Exit.isFailure(result)).toBe(true);
			expect(yield* readRuntimeFx()).toEqual(before);
		}).pipe(
			useGameFx({
				config: automatic,
				state,
			}),
		),
	);
});

it("settles a zero-unit owner and removes its pending work when its active job is cancelled", () => {
	const config = GameConfigSchema.parse({
		...clearItemJobQueueConfig,
		items: {
			...clearItemJobQueueConfig.items,
			forge: {
				...clearItemJobQueueConfig.items.forge,
				units: {
					amount: 2,
				},
			},
		},
	});
	const state = {
		...clearItemJobQueueState,
		items: clearItemJobQueueState.items.map((item, index) => ({
			...item,
			remainingUnits: index === 0 ? 0 : undefined,
		})),
	};
	Effect.runSync(
		Effect.gen(function* () {
			yield* cancelItemJobFx({
				ownerItemId: "runtime:forge:primary",
				jobId: "job:active",
			});
			const after = yield* readRuntimeFx();
			expect(after.items.some((item) => item.id === "runtime:forge:primary")).toBe(false);
			expect(after.jobQueue).toEqual(
				state.jobQueue.filter((request) => request.ownerItemId !== "runtime:forge:primary"),
			);
			expect(after.jobs).toHaveLength(0);
		}).pipe(
			useGameFx({
				config,
				state,
			}),
		),
	);
});
