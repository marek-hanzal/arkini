import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { makeActionChargeSpendRandomFx } from "~/production-action/random/makeActionChargeSpendRandomFx";

const sampleFx = () =>
	makeActionChargeSpendRandomFx({
		actionId: "line:lumberjack:work",
		cost: 1,
		itemId: "runtime:tree",
		ownerItemId: "runtime:lumberjack",
		program: Random.next,
		quantity: 2,
		remainingCharges: 1,
	});

describe("makeActionChargeSpendRandomFx", () => {
	it("replays the same immediate depletion roll for an unchanged failed action", () => {
		const first = Effect.runSync(sampleFx());
		const retry = Effect.runSync(sampleFx());

		expect(retry).toBe(first);
	});
});
