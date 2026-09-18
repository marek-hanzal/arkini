// @vitest-environment jsdom
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { EditorSectionShortcutNavigation } from "~/authoring-shell/ui/EditorSectionBar";
import { useEditorSaveShortcut } from "~/editor-control/ui/useEditorSaveShortcut";
import { Overlay } from "~/ui/ui/Overlay";
import { useSectionShortcuts } from "~/ui/ui/useSectionShortcuts";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
const roots: Array<ReturnType<typeof createRoot>> = [];
const selectFn = vi.fn();
const saveFn = vi.fn();
const closeFn = vi.fn();
const options = [
	{
		label: "All",
		value: "all",
		shortcut: "a",
	},
	{
		label: "Assigned",
		value: "assigned",
		shortcut: "s",
	},
	{
		label: "Unused",
		value: "unused",
		shortcut: "u",
	},
] as const;

const Dialog = () => {
	const target = useRef<HTMLDivElement>(null);
	useEditorSaveShortcut({
		target,
		saveEnabled: true,
		saveFn,
	});
	return (
		<Overlay onCloseFn={closeFn}>
			<div ref={target}>
				<button type="button">Cancel</button>
				<button type="button">Save</button>
			</div>
		</Overlay>
	);
};

const Catalog = ({ modal = false }: { readonly modal?: boolean }) => {
	const [view, setViewFn] = useState("all");
	return (
		<>
			<input />
			<textarea />
			<select>
				<option>One</option>
			</select>
			<div
				contentEditable
				suppressContentEditableWarning
			>
				<span>Draft</span>
			</div>
			<EditorSectionShortcutNavigation
				dataUi="CatalogChoice"
				options={options}
				value={view}
				onChangeFn={(next) => {
					selectFn(next);
					setViewFn(next);
				}}
			/>
			{modal ? <Dialog /> : null}
		</>
	);
};

const pressFn = async (
	key: string,
	target: EventTarget = document.body,
	init: KeyboardEventInit = {},
) => {
	await act(async () =>
		target.dispatchEvent(
			new KeyboardEvent("keydown", {
				key,
				bubbles: true,
				cancelable: true,
				...init,
			}),
		),
	);
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	vi.clearAllMocks();
});

it("switches the mounted catalog like clicking and isolates text editing and modified commands", async () => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	roots.push(root);
	await act(async () => root.render(<Catalog />));
	await pressFn("s");
	expect(selectFn).toHaveBeenCalledExactlyOnceWith("assigned");
	expect(host.querySelector('[data-ui-selected="true"]')?.textContent).toBe("Assigned");
	for (const target of host.querySelectorAll("input, textarea, select"))
		await pressFn("u", target);
	const editable = host.querySelector("[contenteditable] span")!;
	// jsdom does not implement the browser's inherited isContentEditable property.
	Object.defineProperty(editable, "isContentEditable", {
		value: true,
	});
	await pressFn("u", editable);
	for (const init of [
		{
			ctrlKey: true,
		},
		{
			metaKey: true,
		},
		{
			altKey: true,
		},
		{
			shiftKey: true,
		},
		{
			repeat: true,
		},
		{
			isComposing: true,
		},
	])
		await pressFn("u", document.body, init);
	expect(selectFn).toHaveBeenCalledTimes(1);
	await pressFn("u");
	expect(selectFn).toHaveBeenLastCalledWith("unused");
	await act(async () =>
		host.querySelector<HTMLButtonElement>('[data-ui="CatalogChoice"]')!.click(),
	);
	expect(selectFn).toHaveBeenLastCalledWith("all");
	await act(async () => root.render(<div>Other page</div>));
	selectFn.mockClear();
	await pressFn("s");
	expect(selectFn).not.toHaveBeenCalled();
});

it("keeps modal keys and focus local while its targeted Save still works", async () => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	roots.push(root);
	await act(async () =>
		root.render(
			<HotkeysProvider
				defaultOptions={{
					hotkey: {
						platform: "linux",
					},
				}}
			>
				<Catalog modal />
			</HotkeysProvider>,
		),
	);
	const buttons = host.querySelectorAll<HTMLButtonElement>('[data-ui="Overlay"] button');
	expect(document.activeElement).toBe(buttons[0]);
	await pressFn("u", document.activeElement!);
	expect(selectFn).not.toHaveBeenCalled();
	await pressFn("s", document.activeElement!, {
		ctrlKey: true,
	});
	expect(saveFn).toHaveBeenCalledOnce();
	await act(async () => buttons[1]!.focus());
	await pressFn("Tab", document.activeElement!);
	expect(document.activeElement).toBe(buttons[0]);
	await pressFn("Tab", document.activeElement!, {
		shiftKey: true,
	});
	expect(document.activeElement).toBe(buttons[1]);
	await act(async () => host.querySelector<HTMLElement>('[data-ui="Overlay"]')!.focus());
	await pressFn("u", document.activeElement!);
	await pressFn("Tab", document.activeElement!, {
		shiftKey: true,
	});
	expect(document.activeElement).toBe(buttons[1]);
	await pressFn("Escape", document.activeElement!);
	expect(closeFn).toHaveBeenCalledOnce();
	expect(selectFn).not.toHaveBeenCalled();
});

it("keeps unavailable choices unregistered and nested Shift keys separate from parent sections", async () => {
	const parentFn = vi.fn();
	const nestedFn = vi.fn();
	const Harness = ({ enabled }: { readonly enabled: boolean }) => {
		useSectionShortcuts({
			options: [
				{
					shortcut: "t",
				},
			],
			onSelectFn: parentFn,
		});
		useSectionShortcuts({
			enabled,
			options: [
				{
					shortcut: "t",
					shift: true,
				},
			],
			onSelectFn: nestedFn,
		});
		return null;
	};
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	roots.push(root);
	await act(async () => root.render(<Harness enabled />));
	await pressFn("T", document.body, {
		shiftKey: true,
	});
	expect(nestedFn).toHaveBeenCalledOnce();
	expect(parentFn).not.toHaveBeenCalled();
	await pressFn("t");
	expect(parentFn).toHaveBeenCalledOnce();
	expect(nestedFn).toHaveBeenCalledOnce();
	await act(async () => root.render(<Harness enabled={false} />));
	await pressFn("T", document.body, {
		shiftKey: true,
	});
	expect(nestedFn).toHaveBeenCalledOnce();
});
