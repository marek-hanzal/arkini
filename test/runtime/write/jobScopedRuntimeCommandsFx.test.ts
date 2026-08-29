import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { removeItemFx } from "~/engine/runtime/write/removeItemFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";
import { startLineFx } from "~test/job/support/startLineTestFx";

describe("job-scoped runtime commands", () => {
	it("rejects generic removal of reserved material", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* startLineFx({
					ownerItemId: "runtime:forge",
					lineId: "line:forge:run",
				});
				const before = yield* readRuntimeFx();
				const reserved = before.items.find((item) => item.location.scope === "reserved");
				if (reserved === undefined || reserved.location.scope !== "reserved") {
					return yield* Effect.die(new Error("Expected reserved job material."));
				}

				const removed = yield* Effect.result(
					removeItemFx({
						itemId: reserved.id,
						revision: reserved.revision,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					before,
					jobId: reserved.location.jobId,
					removed,
					reservedItemId: reserved.id,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
				}),
			),
		);

		expect(Result.isFailure(result.removed)).toBe(true);
		if (Result.isFailure(result.removed)) {
			expect(result.removed.failure).toMatchObject({
				_tag: "ItemJobScopedError",
				itemId: result.reservedItemId,
				jobId: result.jobId,
			});
		}
		expect(result.after).toEqual(result.before);
	});
});
