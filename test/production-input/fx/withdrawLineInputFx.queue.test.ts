import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { withdrawLineInputFx } from "~/production-input/fx/withdrawLineInputFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { readItemDetailQueueFx } from "~/item-detail-read/fx/readItemDetailQueueFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { bufferInputMaterialForTestFx } from "~test/support/bufferInputMaterialForTestFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import {
	sourceLocation,
	workshopLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";
import {
	lineUid,
	ownerItemId,
	prepareQueuedBufferedLineFx,
	queuedInputTestConfig,
} from "~test/production-input/fx/withdrawLineInputFx.queue.test/prepareQueuedBufferedLineFx";

const otherLineUid = "line:workshop:other";
const config = GameConfigSchema.parse({
	...queuedInputTestConfig,
	items: {
		...queuedInputTestConfig.items,
		workshop: {
			...queuedInputTestConfig.items.workshop,
			lines: [
				...queuedInputTestConfig.items.workshop.lines,
				{
					...queuedInputTestConfig.items.workshop.lines[0],
					uid: otherLineUid,
				},
			],
		},
	},
});

describe("line input withdrawal queue contract", () => {
	it("withdraws one input and cancels only its line queue before autofill can replace it", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const requests = yield* prepareQueuedBufferedLineFx();
				const otherLineRequest = yield* enqueueLineFx({
					ownerItemId,
					lineUid: otherLineUid,
				});
				const before = yield* readRuntimeFx();
				const withdrawal = yield* withdrawLineInputFx({
					inputIndex: 0,
					lineUid,
					ownerItemId,
					amount: "one",
				});
				const after = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				return {
					after,
					before,
					...requests,
					otherLineRequest,
					settled: yield* readRuntimeFx(),
					withdrawal,
					queue: yield* readItemDetailQueueFx({
						itemId: ownerItemId,
						runtime: after,
					}),
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.withdrawal.withdrawnItemCount).toBe(1);
		expect(result.after.jobQueue).toEqual(
			result.before.jobQueue.filter(
				(request) => request.ownerItemId !== ownerItemId || request.lineUid !== lineUid,
			),
		);
		expect(result.after.jobQueue.map(({ id }) => id)).toEqual([
			result.globalRequestIds[1],
			result.otherLineRequest.id,
		]);
		expect(result.queue).toMatchObject({
			active: [],
			kind: "available",
			request: [
				{
					requestId: result.otherLineRequest.id,
				},
			],
		});
		expect(
			result.after.items.filter(
				(item) =>
					item.location.scope === "input" && item.location.ownerItemId === ownerItemId,
			),
		).toHaveLength(2);
		expect(result.settled.jobs.filter((job) => job.lineUid === lineUid)).toEqual([]);
		expect(
			result.settled.items.filter(
				(item) =>
					item.location.scope === "input" && item.location.ownerItemId === ownerItemId,
			),
		).toHaveLength(2);
	});

	it("returns an outbound autofill delivery when withdrawal cancels its queued line", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: ownerItemId,
					itemUid: "workshop",
					location: workshopLocation,
				});
				const buffered = yield* spawnItemFx({
					id: "runtime:buffered-water",
					itemUid: "water",
					location: sourceLocation(1),
				});
				yield* bufferInputMaterialForTestFx({
					ownerItemId,
					lineUid,
					inputIndex: 0,
					sourceItemId: buffered.id,
					sourceItemRevision: buffered.revision,
				});
				for (let index = 2; index <= 3; index++) {
					yield* spawnItemFx({
						id: `runtime:source-water:${index}`,
						itemUid: "water",
						location: sourceLocation(index),
					});
				}
				yield* enqueueLineFx({
					ownerItemId,
					lineUid,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				const outbound = yield* readRuntimeFx();
				yield* withdrawLineInputFx({
					ownerItemId,
					lineUid,
					inputIndex: 0,
					amount: "one",
				});
				return {
					outbound,
					after: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: queuedInputTestConfig,
				}),
			),
		);

		expect(result.outbound.jobQueue).toHaveLength(1);
		expect(
			result.outbound.items.filter(
				(item) => item.location.scope === "delivery" && item.location.phase === "outbound",
			),
		).not.toHaveLength(0);
		expect(result.after.jobQueue).toEqual([]);
		expect(
			result.after.items.filter(
				(item) => item.location.scope === "delivery" && item.location.phase === "outbound",
			),
		).toHaveLength(0);
		expect(
			result.after.items.filter(
				(item) => item.location.scope === "delivery" && item.location.phase === "returning",
			),
		).not.toHaveLength(0);
	});
});
