import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { attemptQueuedLineStartFx } from "~/v1/job/fx/attemptQueuedLineStartFx";
import type { JobQueueRequestSchema } from "~/v1/job/schema/JobQueueRequestSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

const config = createJobTestConfig(2);
const request = {
	id: "job:request",
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
	revision: "revision:request",
} satisfies JobQueueRequestSchema.Type;
const owner = {
	id: request.ownerItemId,
	item: config.items.forge,
	location: {
		scope: "board",
		position: {
			x: 0,
			y: 0,
		},
	},
	quantity: 1,
	revision: "revision:owner",
} satisfies RuntimeItemSchema.Type;

const runAttempt = (runtime: RuntimeSchema.Type, candidate = request) =>
	Effect.runSync(
		Effect.either(
			attemptQueuedLineStartFx({
				request: candidate,
				runtime,
			}),
		).pipe(
			useGameFx({
				config,
			}),
		),
	);

describe("attemptQueuedLineStartFx", () => {
	it("keeps missing inputs as an explicit retryable block", () => {
		const runtime = {
			items: [
				owner,
			],
			jobs: [],
			jobQueue: [
				request,
			],
		} satisfies RuntimeSchema.Type;

		const result = runAttempt(runtime);

		expect(result).toMatchObject({
			_tag: "Right",
			right: {
				type: "blocked",
				error: {
					_tag: "LineRunUnavailableError",
				},
			},
		});
		if (result._tag === "Right") expect(result.right.runtime).toBe(runtime);
	});

	it("keeps an inventory owner as an explicit retryable block", () => {
		const inventoryOwner = {
			...owner,
			location: {
				scope: "inventory",
				position: {
					x: 0,
					y: 0,
				},
			},
		} satisfies RuntimeItemSchema.Type;
		const runtime = {
			items: [
				inventoryOwner,
			],
			jobs: [],
			jobQueue: [
				request,
			],
		} satisfies RuntimeSchema.Type;

		const result = runAttempt(runtime);

		expect(result).toMatchObject({
			_tag: "Right",
			right: {
				type: "blocked",
				error: {
					_tag: "ItemNotOnBoardError",
				},
			},
		});
		if (result._tag === "Right") expect(result.right.runtime).toBe(runtime);
	});

	it("propagates a missing owner instead of retrying forever", () => {
		const runtime = {
			items: [],
			jobs: [],
			jobQueue: [
				request,
			],
		} satisfies RuntimeSchema.Type;

		expect(runAttempt(runtime)).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "ItemNotFoundError",
			},
		});
	});

	it("propagates a missing line instead of retrying forever", () => {
		const missingLineRequest = {
			...request,
			lineId: "line:missing",
		} satisfies JobQueueRequestSchema.Type;
		const runtime = {
			items: [
				owner,
			],
			jobs: [],
			jobQueue: [
				missingLineRequest,
			],
		} satisfies RuntimeSchema.Type;

		expect(runAttempt(runtime, missingLineRequest)).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "LineNotFoundError",
			},
		});
	});
});
