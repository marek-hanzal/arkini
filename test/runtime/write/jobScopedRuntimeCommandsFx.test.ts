import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { removeItemFx } from "~/engine/runtime/write/removeItemFx";
import { setItemQuantityFx } from "~/engine/runtime/write/setItemQuantityFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";
import { startLineFx } from "~test/job/support/startLineTestFx";

describe("job-scoped runtime commands", () => {
	it("rejects generic removal and quantity mutation of reserved material", () => {
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
				const quantity = yield* Effect.result(
					setItemQuantityFx({
						itemId: reserved.id,
						quantity: reserved.quantity + 1,
						revision: reserved.revision,
					}),
				);

				return {
					after: yield* readRuntimeFx(),
					before,
					jobId: reserved.location.jobId,
					quantity,
					removed,
					reservedItemId: reserved.id,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
				}),
			),
		);

		for (const command of [
			result.removed,
			result.quantity,
		]) {
			expect(Result.isFailure(command)).toBe(true);
			if (Result.isFailure(command)) {
				expect(command.failure).toMatchObject({
					_tag: "ItemJobScopedError",
					itemId: result.reservedItemId,
					jobId: result.jobId,
				});
			}
		}
		expect(result.after).toEqual(result.before);
	});
});
