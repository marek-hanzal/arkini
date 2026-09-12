// @vitest-environment jsdom
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { act, useRef, type PropsWithChildren } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorSaveShortcut } from "~/editor-control/ui/useEditorSaveShortcut";

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
	children,
	enabled = true,
	saveFn,
	scoped = false,
}: PropsWithChildren<{
	readonly enabled?: boolean;
	readonly saveFn: () => void | Promise<unknown>;
	readonly scoped?: boolean;
}>) => {
	const target = useRef<HTMLDivElement>(null);
	useEditorSaveShortcut({
		saveEnabled: enabled,
		saveFn,
		target: scoped ? target : undefined,
	});
	return (
		<div ref={target}>
			<textarea />
			{children}
		</div>
	);
};
const setup = () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	return {
		container,
		root,
	};
};
const press = (target: EventTarget, init: KeyboardEventInit = {}) => {
	const event = new KeyboardEvent("keydown", {
		key: "s",
		code: "KeyS",
		ctrlKey: true,
		bubbles: true,
		cancelable: true,
		...init,
	});
	target.dispatchEvent(event);
	return event;
};
describe("Editor Save shortcut", () => {
	it.each([
		"mac",
		"windows",
		"linux",
	] as const)(
		"routes %s Save from a text field to the current callback and releases it on unmount",
		async (platform) => {
			const { container, root } = setup();
			const first = vi.fn();
			const latest = vi.fn();
			const render = async (saveFn: () => void) =>
				act(async () =>
					root.render(
						<HotkeysProvider
							defaultOptions={{
								hotkey: {
									platform,
								},
							}}
						>
							<Probe saveFn={saveFn} />
						</HotkeysProvider>,
					),
				);
			await render(first);
			await render(latest);
			const field = container.querySelector("textarea")!;
			let event: KeyboardEvent;
			await act(async () => {
				event = press(field, {
					metaKey: platform === "mac",
					ctrlKey: platform !== "mac",
				});
			});
			expect(event!.defaultPrevented).toBe(true);
			expect(first).not.toHaveBeenCalled();
			expect(latest).toHaveBeenCalledTimes(1);
			await act(async () => root.render(null));
			expect(
				press(document, {
					metaKey: platform === "mac",
					ctrlKey: platform !== "mac",
				}).defaultPrevented,
			).toBe(false);
			expect(latest).toHaveBeenCalledTimes(1);
		},
	);
	it("suppresses native Save while disabled, repeated, composing or already saving", async () => {
		const { root } = setup();
		let finishFn: () => void = () => undefined;
		const saveFn = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finishFn = resolve;
				}),
		);
		const render = async (enabled: boolean) =>
			act(async () =>
				root.render(
					<HotkeysProvider
						defaultOptions={{
							hotkey: {
								platform: "windows",
							},
						}}
					>
						<Probe
							saveFn={saveFn}
							enabled={enabled}
						/>
					</HotkeysProvider>,
				),
			);
		await render(false);
		expect(press(document).defaultPrevented).toBe(true);
		expect(saveFn).not.toHaveBeenCalled();
		await render(true);
		await act(async () => {
			press(document, {
				repeat: true,
			});
			press(document, {
				isComposing: true,
			});
		});
		expect(saveFn).not.toHaveBeenCalled();
		await act(async () => {
			press(document);
			press(document);
		});
		expect(saveFn).toHaveBeenCalledTimes(1);
		await act(async () => {
			finishFn();
		});
		await act(async () => {
			press(document);
		});
		expect(saveFn).toHaveBeenCalledTimes(2);
		await act(async () => {
			finishFn();
		});
	});
	it("saves a scoped dialog without also saving its underlying page", async () => {
		const { root, container } = setup();
		const pageSave = vi.fn();
		const dialogSave = vi.fn();
		await act(async () =>
			root.render(
				<HotkeysProvider
					defaultOptions={{
						hotkey: {
							platform: "windows",
						},
					}}
				>
					<Probe saveFn={pageSave}>
						<Probe
							scoped
							saveFn={dialogSave}
						/>
					</Probe>
				</HotkeysProvider>,
			),
		);
		await act(async () => {
			press(container.querySelectorAll("textarea")[1]);
		});
		expect(dialogSave).toHaveBeenCalledTimes(1);
		expect(pageSave).not.toHaveBeenCalled();
	});
});
