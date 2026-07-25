import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createPixiGameInteractionControlFx } from "~/ui/pixi/runtime/createPixiGameInteractionControlFx";

describe("Pixi game interaction control", () => {
	it("cancels every registered scene gesture and releases exact registrations", () => {
		const control = Effect.runSync(createPixiGameInteractionControlFx());
		const cancelMain = vi.fn();
		const cancelInventory = vi.fn();
		const unregisterMain = Effect.runSync(control.registerFx(cancelMain));
		Effect.runSync(control.registerFx(cancelInventory));

		Effect.runSync(control.cancelFx);
		expect(cancelMain).toHaveBeenCalledOnce();
		expect(cancelInventory).toHaveBeenCalledOnce();

		unregisterMain();
		Effect.runSync(control.cancelFx);
		expect(cancelMain).toHaveBeenCalledOnce();
		expect(cancelInventory).toHaveBeenCalledTimes(2);
	});
});
