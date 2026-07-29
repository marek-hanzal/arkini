import { expect, it } from "vitest";

import { StateSchema } from "~/engine/state/schema/StateSchema";

it("rejects saves carrying removed delivery start intents", () => {
	expect(
		StateSchema.safeParse({
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [],
			jobs: [],
			deliveryStartIntents: [],
		}).success,
	).toBe(false);
});
