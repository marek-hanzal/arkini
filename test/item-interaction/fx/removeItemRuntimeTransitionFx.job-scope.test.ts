import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { removeCheatItemFx } from "~/engine/cheat/write/removeCheatItemFx";
import { setCheatEnabledFx } from "~/engine/cheat/write/setCheatEnabledFx";
import { useGameFx } from "~test/support/game/useGameFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";
import { startLineFx } from "~test/production-job/support/startLineTestFx";

describe("removeItemRuntimeTransitionFx job scope", () => {
	it("rejects generic removal of reserved material", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* startLineFx({
					ownerItemId: "runtime:forge",
					lineId: "line:forge:run",
				});
				const prepared = yield* readRuntimeFx();
				const reserved = prepared.items.find((item) => item.location.scope === "reserved");
				if (reserved === undefined || reserved.location.scope !== "reserved") {
					return yield* Effect.die(new Error("Expected reserved job material."));
				}

				yield* setCheatEnabledFx({
					enabled: true,
				});
				const before = yield* readRuntimeFx();
				const removed = yield* Effect.result(
					removeCheatItemFx({
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
