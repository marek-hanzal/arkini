import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { makeChargeSpendRandomFx } from "~/engine/job/random/makeChargeSpendRandomFx";

const sampleFx = () =>
	makeChargeSpendRandomFx({
		cost: 1,
		itemId: "runtime:tree",
		lineId: "line:lumberjack:work",
		ownerItemId: "runtime:lumberjack",
		program: Random.next,
		quantity: 2,
		remainingCharges: 1,
	});

describe("makeChargeSpendRandomFx", () => {
	it("replays the same immediate depletion roll for an unchanged failed start", () => {
		const first = Effect.runSync(sampleFx());
		const retry = Effect.runSync(sampleFx());

		expect(retry).toBe(first);
	});
});
