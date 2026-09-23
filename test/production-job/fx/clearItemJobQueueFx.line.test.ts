import { Effect, Result } from "effect";
import { expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { clearItemJobQueueFx } from "~/production-job/fx/clearItemJobQueueFx";
import {
	clearItemJobQueueConfig,
	clearItemJobQueueState,
} from "./clearItemJobQueueFx.test/fixture";

const ownerItemId = "runtime:forge:primary";
const lineId = "line:forge:run";
const otherLineId = "line:forge:other";
const config = GameConfigSchema.parse({
	...clearItemJobQueueConfig,
	items: {
		...clearItemJobQueueConfig.items,
		forge: {
			...clearItemJobQueueConfig.items.forge,
			maxQueueSize: 4,
			lines: [
				...clearItemJobQueueConfig.items.forge!.lines,
				{
					...clearItemJobQueueConfig.items.forge!.lines[0],
					id: otherLineId,
				},
				{
					...clearItemJobQueueConfig.items.forge!.lines[0],
					id: "line:active",
				},
			],
		},
	},
});
const state: StateSchema.Type = {
	...clearItemJobQueueState,
	jobs: clearItemJobQueueState.jobs.map((job) => ({
		...job,
		lineId: "line:active",
	})),
	jobQueue: [
		...clearItemJobQueueState.jobQueue,
		{
			id: "queued:other-line",
			ownerItemId,
			lineId: otherLineId,
		},
	],
	items: [
		...clearItemJobQueueState.items,
		{
			id: "active:material",
			itemUid: "water",

			location: {
				scope: "job",
				jobId: "job:active",
				inputIndex: 0,
			},
		},
		{
			id: "buffer:selected",
			itemUid: "tool",

			location: {
				scope: "input",
				ownerItemId,
				lineId,
				inputIndex: 1,
			},
		},
		{
			id: "buffer:other-line",
			itemUid: "tool",

			location: {
				scope: "input",
				ownerItemId,
				lineId: otherLineId,
				inputIndex: 1,
			},
		},
	],
};

it("clears one owner's selected line atomically while retaining other lines, owners and active material", () => {
	const result = Effect.runSync(
		Effect.gen(function* () {
			const before = yield* readRuntimeFx();
			const previousSequence = (yield* (yield* CommittedTransitionsFx).read).sequence;
			const cleared = yield* clearItemJobQueueFx({
				ownerItemId,
				lineId,
			});
			const after = yield* readRuntimeFx();
			const transition = yield* (yield* CommittedTransitionsFx).read;
			// A stale click and a request belonging to another line are exact no-ops.
			yield* clearItemJobQueueFx({
				ownerItemId,
				lineId,
				requestId: "job:queued:first",
			});
			yield* clearItemJobQueueFx({
				ownerItemId,
				lineId,
				requestId: "queued:other-line",
			});
			return {
				before,
				after,
				cleared,
				transition,
				previousSequence,
				repeated: yield* readRuntimeFx(),
			};
		}).pipe(
			useGameFx({
				config,
				state,
			}),
		),
	);
	expect(result.cleared.map((request) => request.id)).toEqual([
		"job:queued:first",
		"job:queued:second",
	]);
	expect(result.after.jobQueue).toEqual(
		result.before.jobQueue.filter(
			(request) => request.ownerItemId !== ownerItemId || request.lineId !== lineId,
		),
	);
	expect(result.after.jobs).toEqual(result.before.jobs);
	for (const id of [
		"active:material",
		"buffer:other-line",
	]) {
		expect(result.after.items.find((item) => item.id === id)).toEqual(
			result.before.items.find((item) => item.id === id),
		);
	}
	expect(
		result.after.items
			.filter((item) => item.item.uid === "tool" && item.location.scope === "board")
			.map((item) => item.id),
	).toHaveLength(1);
	expect(result.transition.sequence).toBe(result.previousSequence + 1);
	expect(result.transition.events).toContainEqual({
		type: "job-queue:cleared",
		ownerItemId,
		itemUid: "forge",
		clearedRequestCount: 2,
	});
	expect(result.repeated).toBe(result.after);
});

it("rolls back the selected line clear when its buffered material cannot return", () => {
	const blockedConfig = GameConfigSchema.parse({
		...config,
		meta: {
			...config.meta,
			board: {
				width: 2,
				height: 1,
			},
		},
		items: {
			...config.items,
			tool: {
				...config.items.tool,
			},
		},
	});
	const result = Effect.runSync(
		Effect.gen(function* () {
			const before = yield* readRuntimeFx();
			const transition = yield* (yield* CommittedTransitionsFx).read;
			const attempt = yield* Effect.result(
				clearItemJobQueueFx({
					ownerItemId,
					lineId,
				}),
			);
			return {
				before,
				attempt,
				after: yield* readRuntimeFx(),
				transition,
				afterTransition: yield* (yield* CommittedTransitionsFx).read,
			};
		}).pipe(
			useGameFx({
				config: blockedConfig,
				state,
			}),
		),
	);
	expect(result.attempt).toEqual(
		Result.fail(
			expect.objectContaining({
				_tag: "PlacementUnavailableError",
			}),
		),
	);
	expect(result.after).toBe(result.before);
	expect(result.afterTransition).toBe(result.transition);
});
