import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { registerWindowLifecycleFx } from "../../electron/main/registerWindowLifecycleFx";

describe("registerWindowLifecycleFx", () => {
	it("quits the Electron process after the last window closes", () => {
		let closeAllWindows: (() => void) | undefined;
		const quit = vi.fn();

		Effect.runSync(
			registerWindowLifecycleFx({
				on: (event, listener) => {
					if (event === "window-all-closed") {
						closeAllWindows = listener as () => void;
					}
					return undefined as never;
				},
				quit,
			}),
		);

		expect(closeAllWindows).toBeTypeOf("function");
		closeAllWindows?.();
		expect(quit).toHaveBeenCalledOnce();
	});
});
