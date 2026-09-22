import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createGameInteractionControlFx } from "~/tile-interaction/fx/createGameInteractionControlFx";

describe("game interaction control", () => {
	it("cancels every registered scene gesture and releases exact registrations", () => {
		const control = Effect.runSync(createGameInteractionControlFx());
		const cancelMain = vi.fn();
		const cancelSecond = vi.fn();
		const unregisterMain = Effect.runSync(control.registerFx(cancelMain));
		Effect.runSync(control.registerFx(cancelSecond));

		Effect.runSync(control.cancelFx);
		expect(cancelMain).toHaveBeenCalledOnce();
		expect(cancelSecond).toHaveBeenCalledOnce();

		unregisterMain();
		Effect.runSync(control.cancelFx);
		expect(cancelMain).toHaveBeenCalledOnce();
		expect(cancelSecond).toHaveBeenCalledTimes(2);
	});
});
