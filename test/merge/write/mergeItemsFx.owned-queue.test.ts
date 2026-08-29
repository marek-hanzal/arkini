import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { applyMergeRuntimeFx } from "~/engine/merge/fx/applyMergeRuntimeFx";
import { queuedOwnedInputMergeFixture } from "~test/merge/write/mergeItemsFx.owned-queue.test/fixture";

describe("mergeItemsFx owned queue", () => {
	it("preserves the complete runtime when a consumed source owns queued Input work", () => {
		const { config, rule, runtime, serviceState, source, target } =
			queuedOwnedInputMergeFixture;
		const before = structuredClone(runtime);
		const result = Effect.runSync(
			Effect.result(
				applyMergeRuntimeFx({
					rule,
					runtime,
					source,
					target,
				}),
			).pipe(
				useGameFx({
					config,
					state: serviceState,
				}),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result))
			expect(result.failure).toMatchObject({
				_tag: "JobOwnerBusyError",
				ownerItemId: "runtime:source",
				requestIds: [
					"request:child",
				],
			});
		expect(runtime).toEqual(before);
	});
});
