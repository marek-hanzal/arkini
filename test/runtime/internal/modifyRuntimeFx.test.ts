import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { startTestConfig } from "~test/start/fx/support/startTestConfig";

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
