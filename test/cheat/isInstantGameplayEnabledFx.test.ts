import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { isInstantGameplayEnabledFx } from "~/engine/cheat/read/isInstantGameplayEnabledFx";
import { lineRunRuntime } from "~test/line/fx/run/support/lineRunTestRuntime";

describe("isInstantGameplayEnabledFx", () => {
	it("requires both persisted cheat enablement and Instant gameplay", () => {
		const runtime = lineRunRuntime({});
		expect(
			Effect.runSync(
				isInstantGameplayEnabledFx({
					runtime: {
						...runtime,
						cheats: {
							enabled: true,
							everEnabled: true,
							instantGameplay: true,
						},
					},
				}),
			),
		).toBe(true);
		expect(
			Effect.runSync(
				isInstantGameplayEnabledFx({
					runtime: {
						...runtime,
						cheats: {
							enabled: false,
							everEnabled: false,
							instantGameplay: true,
						},
					},
				}),
			),
		).toBe(false);
	});
});
