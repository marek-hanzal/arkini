import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { discardRuntimeItemOwnedStateFx } from "~/game-runtime/fx/discardRuntimeItemOwnedStateFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

const config = createJobTestConfig();
const board = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

const root = {
	id: "runtime:root",
	item: config.items.forge,
	location: board,
	quantity: 1,
	revision: "revision:root",
};

const passiveChild = {
	id: "runtime:child",
	item: config.items.water,
	location: {
		scope: "input" as const,
		ownerItemId: root.id,
		lineId: "line:forge:run",
		inputIndex: 0,
	},
	quantity: 1,
	revision: "revision:child",
};

describe("discardRuntimeItemOwnedStateFx", () => {
	it("discards passive input descendants and default-line intent while preserving the root", () => {
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				root,
				passiveChild,
			],
			jobs: [],
			jobQueue: [],
			defaultLineByOwnerItemId: {
				[root.id]: "line:forge:run",
				[passiveChild.id]: "line:missing",
				"runtime:unrelated": "line:unrelated",
			},
		} satisfies RuntimeSchema.Type;
		const result = Effect.runSync(
			discardRuntimeItemOwnedStateFx({
				ownerItemId: root.id,
				runtime,
			}),
		);

		expect(result.items).toEqual([
			root,
		]);
		expect(result.jobQueue).toEqual([]);
		expect(result.defaultLineByOwnerItemId).toEqual({
			"runtime:unrelated": "line:unrelated",
		});
	});

	it("rejects active or queued work anywhere beneath the discarded ownership tree", () => {
		for (const mode of [
			"active",
			"queued",
		] as const) {
			const busyId = mode === "active" ? "job:child" : "request:child";
			const busyEntry = {
				id: busyId,
				ownerItemId: passiveChild.id,
				lineId: "line:missing",
			};
			const runtime = {
				cheats: {
					enabled: false,
					everEnabled: false,
					instantGameplay: false,
				},
				currentSpace: 0,
				items: [
					root,
					passiveChild,
					...(mode === "active"
						? [
								{
									id: "runtime:job-material",
									item: config.items.tool,
									location: {
										scope: "reserved" as const,
										jobId: busyId,
									},
									quantity: 1,
									revision: "revision:job-material",
								},
							]
						: []),
				],
				jobs:
					mode === "active"
						? [
								{
									...busyEntry,
									durationMs: 200,
									remainingMs: 200,
								},
							]
						: [],
				jobQueue:
					mode === "queued"
						? [
								busyEntry,
							]
						: [],
				defaultLineByOwnerItemId: {},
			} satisfies RuntimeSchema.Type;
			const result = Effect.runSync(
				Effect.result(
					discardRuntimeItemOwnedStateFx({
						ownerItemId: root.id,
						runtime,
					}),
				),
			);

			expect(Result.isFailure(result)).toBe(true);
			if (Result.isFailure(result)) {
				expect(result.failure).toMatchObject({
					_tag: "JobOwnerBusyError",
					ownerItemId: root.id,
					...(mode === "active"
						? {
								jobIds: [
									busyId,
								],
							}
						: {
								requestIds: [
									busyId,
								],
							}),
				});
			}
			expect(runtime.items).toHaveLength(mode === "active" ? 3 : 2);
			expect(runtime.jobs).toHaveLength(mode === "active" ? 1 : 0);
			expect(runtime.jobQueue).toHaveLength(mode === "queued" ? 1 : 0);
		}
	});
});
