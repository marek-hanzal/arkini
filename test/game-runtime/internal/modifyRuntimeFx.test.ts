import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { modifyRuntimeFx } from "~/game-runtime/internal/modifyRuntimeFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { startTestConfig } from "~test/game-start/support/startTestConfig";

describe("modifyRuntimeFx", () => {
	it("pins nested runtime reads to the serialized transaction snapshot", () => {
		const result = Effect.runSync(
			modifyRuntimeFx((runtime) => {
				return Effect.gen(function* () {
					const nestedRead = yield* readRuntimeFx();

					return [
						{
							nestedRead,
							runtime,
						},
						runtime,
					] as const;
				});
			}).pipe(
				useGameFx({
					config: startTestConfig,
				}),
			),
		);

		expect(result.nestedRead).toBe(result.runtime);
	});
});
