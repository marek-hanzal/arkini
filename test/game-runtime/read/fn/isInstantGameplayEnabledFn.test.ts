import { describe, expect, it } from "vitest";

import { isInstantGameplayEnabledFn } from "~/game-runtime/read/fn/isInstantGameplayEnabledFn";
import { lineRunRuntime } from "~test/production-line/fx/run/support/lineRunTestRuntime";

describe("isInstantGameplayEnabledFn", () => {
	it("requires both persisted cheat enablement and Instant gameplay", () => {
		const runtime = lineRunRuntime({});
		expect(
			isInstantGameplayEnabledFn({
				runtime: {
					...runtime,
					cheats: {
						enabled: true,
						everEnabled: true,
						instantGameplay: true,
					},
				},
			}),
		).toBe(true);
		expect(
			isInstantGameplayEnabledFn({
				runtime: {
					...runtime,
					cheats: {
						enabled: false,
						everEnabled: false,
						instantGameplay: true,
					},
				},
			}),
		).toBe(false);
	});
});
