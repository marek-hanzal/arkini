import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { attemptQueuedLineStartFx } from "~/production-job/fx/attemptQueuedLineStartFx";
import type { JobQueueRequestSchema } from "~/production-job/schema/JobQueueRequestSchema";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";

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

const runAttempt = (runtime: RuntimeSchema.Type, requestId = request.id) =>
	Effect.runSync(
		Effect.result(
			attemptQueuedLineStartFx({
				requestId,
				runtime,
			}),
		).pipe(
			useGameFx({
				config,
			}),
		),
	);

describe("attemptQueuedLineStartFx", () => {
	it("returns empty when the exact request is not a live FIFO head", () => {
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				owner,
			],
			jobs: [],
			jobQueue: [],

			defaultLineByOwnerItemId: {},
		} satisfies RuntimeSchema.Type;

		const result = runAttempt(runtime);

		expect(result).toMatchObject({
			_tag: "Success",
			success: {
				type: "empty",
			},
		});
		if (result._tag === "Success") expect(result.success.runtime).toBe(runtime);
	});

	it("does not start a later request from the same owner", () => {
		const later = {
			...request,
			id: "job:request:later",
		} satisfies JobQueueRequestSchema.Type;
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				owner,
			],
			jobs: [],
			jobQueue: [
				request,
				later,
			],

			defaultLineByOwnerItemId: {},
		} satisfies RuntimeSchema.Type;

		const result = runAttempt(runtime, later.id);

		expect(result).toMatchObject({
			_tag: "Success",
			success: {
				type: "empty",
			},
		});
		if (result._tag === "Success") expect(result.success.runtime).toBe(runtime);
	});

	it("keeps missing inputs as an explicit retryable block", () => {
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				owner,
			],
			jobs: [],
			jobQueue: [
				request,
			],

			defaultLineByOwnerItemId: {},
		} satisfies RuntimeSchema.Type;

		const result = runAttempt(runtime);

		expect(result).toMatchObject({
			_tag: "Success",
			success: {
				type: "blocked",
				error: {
					_tag: "LineRunUnavailableError",
				},
			},
		});
		if (result._tag === "Success") expect(result.success.runtime).toBe(runtime);
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
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				inventoryOwner,
			],
			jobs: [],
			jobQueue: [
				request,
			],

			defaultLineByOwnerItemId: {},
		} satisfies RuntimeSchema.Type;

		const result = runAttempt(runtime);

		expect(result).toMatchObject({
			_tag: "Success",
			success: {
				type: "blocked",
				error: {
					_tag: "ItemNotOnBoardError",
				},
			},
		});
		if (result._tag === "Success") expect(result.success.runtime).toBe(runtime);
	});

	it("propagates a missing owner instead of retrying forever", () => {
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [],
			jobs: [],
			jobQueue: [
				request,
			],

			defaultLineByOwnerItemId: {},
		} satisfies RuntimeSchema.Type;

		expect(runAttempt(runtime)).toMatchObject({
			_tag: "Failure",
			failure: {
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
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				owner,
			],
			jobs: [],
			jobQueue: [
				missingLineRequest,
			],

			defaultLineByOwnerItemId: {},
		} satisfies RuntimeSchema.Type;

		expect(runAttempt(runtime)).toMatchObject({
			_tag: "Failure",
			failure: {
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
					requestId: request.id,
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
