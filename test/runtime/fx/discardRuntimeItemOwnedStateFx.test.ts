import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { discardRuntimeItemOwnedStateFx } from "~/v1/runtime/fx/discardRuntimeItemOwnedStateFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

const config = createJobTestConfig();
const board = {
	scope: "board" as const,
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
	it("discards passive input descendants and queued intents while preserving the root", () => {
		const runtime = {
			items: [
				root,
				passiveChild,
			],
			jobs: [],
			jobQueue: [
				{
					id: "request:child",
					ownerItemId: passiveChild.id,
					lineId: "line:missing",
				},
			],
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
	});

	it("rejects committed work anywhere beneath the discarded ownership tree", () => {
		const runtime = {
			items: [
				root,
				passiveChild,
				{
					id: "runtime:job-material",
					item: config.items.tool,
					location: {
						scope: "reserved",
						jobId: "job:child",
					},
					quantity: 1,
					revision: "revision:job-material",
				},
			],
			jobs: [
				{
					id: "job:child",
					ownerItemId: passiveChild.id,
					lineId: "line:missing",
					durationMs: 200,
					remainingMs: 200,
				},
			],
			jobQueue: [],
		} satisfies RuntimeSchema.Type;
		const result = Effect.runSync(
			Effect.either(
				discardRuntimeItemOwnedStateFx({
					ownerItemId: root.id,
					runtime,
				}),
			),
		);

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toMatchObject({
				_tag: "JobOwnerBusyError",
				ownerItemId: root.id,
				jobIds: [
					"job:child",
				],
			});
		}
		expect(runtime.items).toHaveLength(3);
		expect(runtime.jobs).toHaveLength(1);
	});
});
