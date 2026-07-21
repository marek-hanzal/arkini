import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { attemptQueuedLineStartFx } from "~/engine/job/fx/attemptQueuedLineStartFx";
import type { JobQueueRequestSchema } from "~/engine/job/schema/JobQueueRequestSchema";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";

const config = createJobTestConfig(2);
const request = {
	id: "job:request",
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
} satisfies JobQueueRequestSchema.Type;
const owner = {
	id: request.ownerItemId,
	item: config.items.forge,
	location: {
		scope: "board",
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	quantity: 1,
	revision: "revision:owner",
} satisfies RuntimeItemSchema.Type;

const runAttempt = (runtime: RuntimeSchema.Type, ownerItemId = request.ownerItemId) =>
	Effect.runSync(
		Effect.either(
			attemptQueuedLineStartFx({
				ownerItemId,
				runtime,
			}),
		).pipe(
			useGameFx({
				config,
			}),
		),
	);

describe("attemptQueuedLineStartFx", () => {
	it("returns empty when the owner has no live queued request", () => {
		const runtime = {
			cheats: {
				enabled: false,
				instantGameplay: false,
			},
			session: {
				speedMode: "normal" as const,
			},
			currentSpace: 0,
			items: [
				owner,
			],
			jobs: [],
			jobQueue: [],
		} satisfies RuntimeSchema.Type;

		const result = runAttempt(runtime);

		expect(result).toMatchObject({
			_tag: "Right",
			right: {
				type: "empty",
			},
		});
		if (result._tag === "Right") expect(result.right.runtime).toBe(runtime);
	});

	it("keeps missing inputs as an explicit retryable block", () => {
		const runtime = {
			cheats: {
				enabled: false,
				instantGameplay: false,
			},
			session: {
				speedMode: "normal" as const,
			},
			currentSpace: 0,
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
			cheats: {
				enabled: false,
				instantGameplay: false,
			},
			session: {
				speedMode: "normal" as const,
			},
			currentSpace: 0,
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
			cheats: {
				enabled: false,
				instantGameplay: false,
			},
			session: {
				speedMode: "normal" as const,
			},
			currentSpace: 0,
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

	it("propagates a missing line from the live FIFO head", () => {
		const missingLineRequest = {
			...request,
			lineId: "line:missing",
		} satisfies JobQueueRequestSchema.Type;
		const runtime = {
			cheats: {
				enabled: false,
				instantGameplay: false,
			},
			session: {
				speedMode: "normal" as const,
			},
			currentSpace: 0,
			items: [
				owner,
			],
			jobs: [],
			jobQueue: [
				missingLineRequest,
			],
		} satisfies RuntimeSchema.Type;

		expect(runAttempt(runtime)).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "LineNotFoundError",
			},
		});
	});

	it("starts only the owner's live FIFO head through the canonical pipeline", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				const prepared = yield* readRuntimeFx();
				const secondRequest = {
					...request,
					id: "job:request:second",
				} satisfies JobQueueRequestSchema.Type;
				const runtime = {
					...prepared,
					jobQueue: [
						request,
						secondRequest,
					],
				} satisfies RuntimeSchema.Type;
				return yield* attemptQueuedLineStartFx({
					ownerItemId: request.ownerItemId,
					runtime,
				});
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.type).toBe("started");
		if (result.type !== "started") throw new Error("Expected the FIFO request to start.");
		expect(result.job.lineId).toBe(request.lineId);
		expect(result.runtime.jobQueue).toEqual([
			expect.objectContaining({
				id: "job:request:second",
			}),
		]);
	});
});
