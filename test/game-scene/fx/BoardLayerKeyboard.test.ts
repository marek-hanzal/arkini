// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bindBoardLayerKeyboardFx } from "~/game-scene/fx/bindBoardLayerKeyboardFx";
import { createBoardLayerControlFx } from "~/game-scene/fx/createBoardLayerControlFx";

const cleanup: Array<() => void> = [];
afterEach(() => {
	for (const closeFn of cleanup.splice(0)) closeFn();
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

const mountFn = () => {
	const control = Effect.runSync(createBoardLayerControlFx());
	const binding = Effect.runSync(
		bindBoardLayerKeyboardFx({
			control,
			window,
			document,
		}),
	);
	cleanup.push(() => Effect.runSync(binding.closeFx));
	return {
		control,
		binding,
	};
};

const altFn = (type: "keydown" | "keyup", init: KeyboardEventInit = {}) =>
	new KeyboardEvent(type, {
		key: "Alt",
		bubbles: true,
		cancelable: true,
		...init,
	});

describe("Board layer keyboard hold", () => {
	it("uses Alt/Option momentarily and releases even when keyup arrives over an input", () => {
		const { control } = mountFn();
		const listenerFn = vi.fn();
		Effect.runSync(control.subscribeFx(listenerFn));
		window.dispatchEvent(altFn("keydown"));
		window.dispatchEvent(
			altFn("keydown", {
				repeat: true,
			}),
		);
		expect(Effect.runSync(control.readLayerFx)).toBe("ground");
		expect(listenerFn).toHaveBeenCalledOnce();
		const input = document.createElement("input");
		document.body.append(input);
		input.dispatchEvent(altFn("keyup"));
		expect(Effect.runSync(control.readLayerFx)).toBe("content");
	});

	it("does not capture text editing, consumed keys, or AltGr/Command combinations", () => {
		const { control } = mountFn();
		const input = document.createElement("input");
		document.body.append(input);
		const editing = altFn("keydown");
		input.dispatchEvent(editing);
		expect(editing.defaultPrevented).toBe(false);
		const consumed = altFn("keydown");
		consumed.preventDefault();
		window.dispatchEvent(consumed);
		window.dispatchEvent(
			altFn("keydown", {
				ctrlKey: true,
			}),
		);
		window.dispatchEvent(
			altFn("keydown", {
				metaKey: true,
			}),
		);
		window.dispatchEvent(
			altFn("keydown", {
				repeat: true,
			}),
		);
		expect(Effect.runSync(control.readLayerFx)).toBe("content");
	});

	it("clears lost key releases on blur, hidden document and unmount, then removes listeners", () => {
		const { control, binding } = mountFn();
		window.dispatchEvent(altFn("keydown"));
		window.dispatchEvent(new Event("blur"));
		expect(Effect.runSync(control.readLayerFx)).toBe("content");
		window.dispatchEvent(altFn("keydown"));
		vi.spyOn(document, "hidden", "get").mockReturnValue(true);
		document.dispatchEvent(new Event("visibilitychange"));
		expect(Effect.runSync(control.readLayerFx)).toBe("content");
		window.dispatchEvent(altFn("keydown"));
		Effect.runSync(binding.closeFx);
		expect(Effect.runSync(control.readLayerFx)).toBe("content");
		window.dispatchEvent(altFn("keydown"));
		expect(Effect.runSync(control.readLayerFx)).toBe("content");
		const replacement = Effect.runSync(
			bindBoardLayerKeyboardFx({
				control,
				window,
				document,
			}),
		);
		cleanup.push(() => Effect.runSync(replacement.closeFx));
		window.dispatchEvent(altFn("keydown"));
		Effect.runSync(binding.closeFx);
		expect(Effect.runSync(control.readLayerFx)).toBe("ground");
	});
});
