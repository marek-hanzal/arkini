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
	scope,
}: {
	readonly discardEnabled?: boolean;
	readonly discardFn: () => void | Promise<unknown>;
	readonly scope?: "page" | "overlay" | "dialog";
}) => {
	useEditorDiscardShortcut({
		discardEnabled,
		discardFn,
		scope,
	});
	return (
		<>
			<textarea />
			<button type="button">Outside text</button>
		</>
	);
};

const pressKey = (target: EventTarget, key: string, init: KeyboardEventInit = {}) => {
	const event = new KeyboardEvent("keydown", {
		key,
		bubbles: true,
		cancelable: true,
		...init,
	});
	target.dispatchEvent(event);
	return event;
};
const pressEscape = (target: EventTarget, init: KeyboardEventInit = {}) =>
	pressKey(target, "Escape", init);

describe("Editor Discard shortcut", () => {
	it("uses plain d to discard while preserving typing and modified shortcuts", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const discardFn = vi.fn();
		await act(async () => root.render(<Probe discardFn={discardFn} />));
		const button = container.querySelector("button")!;
		const textarea = container.querySelector("textarea")!;
		await act(async () => {
			pressKey(textarea, "d");
			pressKey(button, "d", {
				ctrlKey: true,
			});
			pressKey(button, "d", {
				shiftKey: true,
			});
		});
		const dialog = document.createElement("div");
		dialog.dataset.ui = "EditorUnsavedChangesDialog";
		document.body.append(dialog);
		await act(async () => {
			pressKey(button, "d");
		});
		dialog.remove();
		expect(discardFn).not.toHaveBeenCalled();
		const conflictingFn = vi.fn();
		button.addEventListener("keydown", conflictingFn);
		let event: KeyboardEvent;
		await act(async () => {
			event = pressKey(button, "d");
		});
		expect(event!.defaultPrevented).toBe(true);
		expect(discardFn).toHaveBeenCalledOnce();
		expect(conflictingFn).not.toHaveBeenCalled();
	});

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

	it("discards the overlay editor without discarding the page beneath it", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const pageDiscardFn = vi.fn();
		const overlayDiscardFn = vi.fn();
		await act(async () =>
			root.render(
				<>
					<Probe discardFn={pageDiscardFn} />
					<div data-ui="Overlay">
						<Probe
							discardFn={overlayDiscardFn}
							scope="overlay"
						/>
					</div>
				</>,
			),
		);
		const overlay = container.querySelector('[data-ui="Overlay"]')!;
		await act(async () => {
			pressKey(overlay.querySelector("textarea")!, "d");
			pressKey(overlay.querySelector("button")!, "d");
		});
		expect(overlayDiscardFn).toHaveBeenCalledOnce();
		expect(pageDiscardFn).not.toHaveBeenCalled();
	});

	it("routes d to the unsaved-changes dialog before the underlying editor", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const pageDiscardFn = vi.fn();
		const dialogDiscardFn = vi.fn();
		await act(async () =>
			root.render(
				<>
					<Probe discardFn={pageDiscardFn} />
					<div data-ui="EditorUnsavedChangesDialog">
						<Probe
							discardFn={dialogDiscardFn}
							scope="dialog"
						/>
					</div>
				</>,
			),
		);
		const dialog = container.querySelector('[data-ui="EditorUnsavedChangesDialog"]')!;
		await act(async () => {
			pressKey(dialog.querySelector("button")!, "d");
		});
		expect(dialogDiscardFn).toHaveBeenCalledOnce();
		expect(pageDiscardFn).not.toHaveBeenCalled();
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
