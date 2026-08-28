import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createSubscriptionReplayGateFx } from "~/ui/pixi/scene/createSubscriptionReplayGateFx";

describe("subscription replay gate", () => {
	it("hydrates only the first replay of the already mounted snapshot", () => {
		const gate = Effect.runSync(createSubscriptionReplayGateFx(12));

		expect(Effect.runSync(gate.classifyFx(12))).toBe("hydrate");
		expect(Effect.runSync(gate.classifyFx(12))).toBe("present");
		expect(Effect.runSync(gate.classifyFx(13))).toBe("present");
	});

	it("presents a newer transition even when it wins the subscription race", () => {
		const gate = Effect.runSync(createSubscriptionReplayGateFx(12));

		expect(Effect.runSync(gate.classifyFx(13))).toBe("present");
		expect(Effect.runSync(gate.classifyFx(14))).toBe("present");
	});
});
