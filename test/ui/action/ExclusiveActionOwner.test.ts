import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createExclusiveActionOwnerFx } from "~/ui/action/createExclusiveActionOwnerFx";

describe("ExclusiveActionOwner", () => {
	it("admits only the first same-tick action and publishes one shared snapshot", () => {
		const owner = Effect.runSync(createExclusiveActionOwnerFx<"exit" | "remove">());
		const listener = vi.fn();
		owner.subscribe(listener);

		expect(Effect.runSync(owner.claimFx("exit"))).toBe(true);
		expect(Effect.runSync(owner.claimFx("exit"))).toBe(false);
		expect(Effect.runSync(owner.claimFx("remove"))).toBe(false);
		expect(owner.getSnapshot()).toBe("exit");
		expect(listener).toHaveBeenCalledOnce();
	});

	it("releases only the matching action and can be claimed again after rejection cleanup", () => {
		const owner = Effect.runSync(createExclusiveActionOwnerFx<"exit" | "remove">());
		const listener = vi.fn();
		owner.subscribe(listener);

		Effect.runSync(owner.claimFx("exit"));
		Effect.runSync(owner.releaseFx("remove"));
		expect(owner.getSnapshot()).toBe("exit");
		expect(listener).toHaveBeenCalledOnce();

		Effect.runSync(owner.releaseFx("exit"));
		expect(owner.getSnapshot()).toBeNull();
		expect(Effect.runSync(owner.claimFx("remove"))).toBe(true);
		expect(owner.getSnapshot()).toBe("remove");
		expect(listener).toHaveBeenCalledTimes(3);
	});
});
