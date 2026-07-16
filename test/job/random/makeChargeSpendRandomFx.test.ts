import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { makeChargeSpendRandomFx } from "~/engine/job/random/makeChargeSpendRandomFx";

const sampleFx = () =>
	Effect.gen(function* () {
		const random = yield* makeChargeSpendRandomFx({
			cost: 1,
			itemId: "runtime:tree",
			lineId: "line:lumberjack:work",
			ownerItemId: "runtime:lumberjack",
			quantity: 2,
			remainingCharges: 1,
		});
		return yield* Random.next.pipe(Effect.withRandom(random));
	});

describe("makeChargeSpendRandomFx", () => {
	it("replays the same immediate depletion roll for an unchanged failed start", () => {
		const first = Effect.runSync(sampleFx());
		const retry = Effect.runSync(sampleFx());

		expect(retry).toBe(first);
	});
});
