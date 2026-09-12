import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { makeActionUnitSpendRandomFx } from "~/production-action/fx/makeActionUnitSpendRandomFx";

const sampleFx = () =>
	makeActionUnitSpendRandomFx({
		actionId: "line:lumberjack:work",
		cost: 1,
		itemId: "runtime:tree",
		ownerItemId: "runtime:lumberjack",
		program: Random.next,
		quantity: 2,
		remainingUnits: 1,
	});

describe("makeActionUnitSpendRandomFx", () => {
	it("replays the same immediate depletion roll for an unchanged failed action", () => {
		const first = Effect.runSync(sampleFx());
		const retry = Effect.runSync(sampleFx());

		expect(retry).toBe(first);
	});
});
