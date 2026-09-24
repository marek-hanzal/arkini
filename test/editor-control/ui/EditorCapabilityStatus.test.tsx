// @vitest-environment jsdom

import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { Power } from "lucide-react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it("enables the mounted capability with e without stealing text input", async () => {
	const host = document.createElement("div");
	const input = document.createElement("input");
	document.body.append(host, input);
	const root = createRoot(host);
	const enableFn = vi.fn();
	try {
		await act(async () =>
			root.render(
				<HotkeysProvider>
					<EditorCapabilityStatus
						actionLabel="Enable"
						icon={Power}
						onEnableFn={enableFn}
						title="No merges"
					/>
				</HotkeysProvider>,
			),
		);
		await act(async () => {
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "e",
					bubbles: true,
				}),
			);
			document.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "e",
					ctrlKey: true,
					bubbles: true,
				}),
			);
		});
		expect(enableFn).not.toHaveBeenCalled();
		const dialog = document.createElement("div");
		dialog.dataset.ui = "EditorUnsavedChangesDialog";
		document.body.append(dialog);
		await act(async () => {
			document.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "e",
					bubbles: true,
				}),
			);
		});
		dialog.remove();
		expect(enableFn).not.toHaveBeenCalled();
		await act(async () => {
			document.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "e",
					bubbles: true,
				}),
			);
		});
		expect(enableFn).toHaveBeenCalledOnce();
	} finally {
		await act(async () => root.unmount());
		host.remove();
		input.remove();
	}
});
