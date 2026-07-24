import { describe, expect, it, vi } from "vitest";

import { createExclusiveActionOwner } from "~/ui/action/useExclusiveAction";

describe("ExclusiveActionOwner", () => {
	it("admits only the first same-tick action and publishes one shared snapshot", () => {
		const owner = createExclusiveActionOwner<"exit" | "remove">();
		const listener = vi.fn();
		owner.subscribe(listener);

		expect(owner.claim("exit")).toBe(true);
		expect(owner.claim("exit")).toBe(false);
		expect(owner.claim("remove")).toBe(false);
		expect(owner.getSnapshot()).toBe("exit");
		expect(listener).toHaveBeenCalledOnce();
	});

	it("releases only the matching action and can be claimed again after rejection cleanup", () => {
		const owner = createExclusiveActionOwner<"exit" | "remove">();
		const listener = vi.fn();
		owner.subscribe(listener);

		owner.claim("exit");
		owner.release("remove");
		expect(owner.getSnapshot()).toBe("exit");
		expect(listener).toHaveBeenCalledOnce();

		owner.release("exit");
		expect(owner.getSnapshot()).toBeNull();
		expect(owner.claim("remove")).toBe(true);
		expect(owner.getSnapshot()).toBe("remove");
		expect(listener).toHaveBeenCalledTimes(3);
	});
});
