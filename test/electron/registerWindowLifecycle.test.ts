import { describe, expect, it, vi } from "vitest";
import { registerWindowLifecycle } from "../../electron/main/registerWindowLifecycle";

describe("registerWindowLifecycle", () => {
	it("quits the Electron process after the last window closes", () => {
		let closeAllWindows: (() => void) | undefined;
		const quit = vi.fn();

		registerWindowLifecycle({
			on: (event, listener) => {
				if (event === "window-all-closed") {
					closeAllWindows = listener as () => void;
				}
				return undefined as never;
			},
			quit,
		});

		expect(closeAllWindows).toBeTypeOf("function");
		closeAllWindows?.();
		expect(quit).toHaveBeenCalledOnce();
	});
});
