// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorDiscardShortcut } from "~/editor-control/ui/useEditorDiscardShortcut";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
const roots: Array<ReturnType<typeof createRoot>> = [];
afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const Probe = ({
	discardEnabled = true,
	discardFn,
}: {
	readonly discardEnabled?: boolean;
	readonly discardFn: () => void | Promise<unknown>;
}) => {
	useEditorDiscardShortcut({
		discardEnabled,
		discardFn,
	});
	return <textarea />;
};

const pressEscape = (target: EventTarget, init: KeyboardEventInit = {}) => {
	const event = new KeyboardEvent("keydown", {
		key: "Escape",
		bubbles: true,
		cancelable: true,
		...init,
	});
	target.dispatchEvent(event);
	return event;
};

describe("Editor Discard shortcut", () => {
	it("routes Escape from a form field to the latest discard callback", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const first = vi.fn();
		const latest = vi.fn();
		await act(async () => root.render(<Probe discardFn={first} />));
		await act(async () => root.render(<Probe discardFn={latest} />));
		let event: KeyboardEvent;
		await act(async () => {
			event = pressEscape(container.querySelector("textarea")!);
		});
		expect(event!.defaultPrevented).toBe(true);
		expect(first).not.toHaveBeenCalled();
		expect(latest).toHaveBeenCalledOnce();
	});

	it("leaves handled, disabled, repeated and composing Escape events alone", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const discardFn = vi.fn();
		await act(async () => root.render(<Probe discardFn={discardFn} />));
		const handled = new KeyboardEvent("keydown", {
			key: "Escape",
			bubbles: true,
			cancelable: true,
		});
		handled.preventDefault();
		await act(async () => {
			window.dispatchEvent(handled);
			pressEscape(window, {
				repeat: true,
			});
			pressEscape(window, {
				isComposing: true,
			});
		});
		await act(async () =>
			root.render(
				<Probe
					discardEnabled={false}
					discardFn={discardFn}
				/>,
			),
		);
		await act(async () => {
			pressEscape(window);
		});
		expect(discardFn).not.toHaveBeenCalled();
	});

	it("does not start a second discard while the first is pending", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		let finishFn: () => void = () => undefined;
		const discardFn = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finishFn = resolve;
				}),
		);
		await act(async () => root.render(<Probe discardFn={discardFn} />));
		await act(async () => {
			pressEscape(window);
			pressEscape(window);
		});
		expect(discardFn).toHaveBeenCalledOnce();
		await act(async () => finishFn());
		await act(async () => {
			pressEscape(window);
		});
		expect(discardFn).toHaveBeenCalledTimes(2);
		await act(async () => finishFn());
	});
});
