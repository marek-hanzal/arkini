import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createPlannerSearchHarnessFx } from "./support/createPlannerSearchHarnessFx";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

describe("searchPlannerRuntimeFx official Bakery", () => {
	it("constructs the Bakery through a one-state demand-driven frontier", async () => {
		const config = await readArkiniGameConfigSource();
		const planner = Effect.runSync(createPlannerSearchHarnessFx(config));
		const result = await Effect.runPromise(
			planner.searchFx("producer:bakery-t1", 1, {
				maximumExpandedStates: 1_000,
				maximumQueuedStates: 1,
				maximumTraceLength: 500,
			}),
		);

		expect(result.type).toBe("completed");
		if (result.type !== "completed") return;
		expect(result.availableQuantity).toBeGreaterThanOrEqual(1);
		expect(result.trace).toContainEqual(
			expect.objectContaining({
				action: {
					kind: "line",
					lineId: "line:blueprint:bakery-t1:construct",
					ownerItemId: "item:blueprint-bakery-t1",
				},
			}),
		);
		expect(result.expandedStates).toBeLessThan(1_000);
	});
});
