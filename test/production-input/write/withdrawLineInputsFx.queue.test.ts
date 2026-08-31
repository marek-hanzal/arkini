import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { withdrawLineInputFx } from "~/production-input/write/withdrawLineInputFx";
import { withdrawLineInputsFx } from "~/production-input/write/withdrawLineInputsFx";
import { readItemDetailQueueFx } from "~/engine/item-detail/read/readItemDetailQueueFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import {
	lineId,
	ownerItemId,
	prepareQueuedBufferedLineFx,
	queuedInputTestConfig,
} from "~test/production-input/write/withdrawLineInputsFx.queue.test/prepareQueuedBufferedLineFx";

const assertPreservedBlockedQueue = ({
	after,
	before,
	firstRequestId,
	globalRequestIds,
	queue,
	secondRequestId,
}: {
	readonly after: RuntimeSchema.Type;
	readonly before: RuntimeSchema.Type;
	readonly firstRequestId: string;
	readonly globalRequestIds: ReadonlyArray<string>;
	readonly queue: readItemDetailQueueFx.Result;
	readonly secondRequestId: string;
}) => {
	expect(after.jobQueue).toEqual(before.jobQueue);
	expect(after.jobQueue?.map(({ id }) => id)).toEqual(globalRequestIds);
	expect(queue).toMatchObject({
		active: [],
		kind: "available",
		request: [
			{
				requestId: firstRequestId,
				status: "waiting-inputs",
			},
			{
				requestId: secondRequestId,
				status: "blocked-earlier",
			},
		],
	});
};

describe("line input withdrawal queue contract", () => {
	it("preserves queued IDs and global FIFO order when withdrawing all line inputs", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const requests = yield* prepareQueuedBufferedLineFx();
				const before = yield* readRuntimeFx();
				yield* withdrawLineInputsFx({
					lineId,
					ownerItemId,
				});
				const after = yield* readRuntimeFx();
				return {
					after,
					before,
					...requests,
					queue: yield* readItemDetailQueueFx({
						itemId: ownerItemId,
						runtime: after,
					}),
				};
			}).pipe(
				useGameFx({
					config: queuedInputTestConfig,
				}),
			),
		);

		assertPreservedBlockedQueue(result);
	});

	it("preserves queued IDs and global FIFO order when withdrawing one input", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const requests = yield* prepareQueuedBufferedLineFx();
				const before = yield* readRuntimeFx();
				yield* withdrawLineInputFx({
					inputIndex: 0,
					lineId,
					ownerItemId,
				});
				const after = yield* readRuntimeFx();
				return {
					after,
					before,
					...requests,
					queue: yield* readItemDetailQueueFx({
						itemId: ownerItemId,
						runtime: after,
					}),
				};
			}).pipe(
				useGameFx({
					config: queuedInputTestConfig,
				}),
			),
		);

		assertPreservedBlockedQueue(result);
	});
});
