// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { useDialogFocus } from "~/ui/focus/useDialogFocus";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const DialogHarness = () => {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button
				onClick={() => setOpen(true)}
				type="button"
			>
				Open
			</button>
			{open ? <MountedDialog onClose={() => setOpen(false)} /> : null}
		</>
	);
};

const MountedDialog = ({ onClose }: { readonly onClose: () => void }) => {
	const { dialogRef, keepFocusInside } = useDialogFocus({
		onClose,
	});
	return (
		<div
			onKeyDown={keepFocusInside}
			ref={dialogRef}
			role="dialog"
			tabIndex={-1}
		>
			<button type="button">First</button>
			<button type="button">Last</button>
		</div>
	);
};

describe("useDialogFocus", () => {
	it("owns focus entry, containment, Escape, and restoration", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		await act(async () => root.render(<DialogHarness />));
		const open = container.querySelector<HTMLButtonElement>("button");
		if (open === null) throw new Error("Missing dialog trigger.");
		open.focus();
		await act(async () => open.click());

		const controls = container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button');
		const first = controls[0];
		const last = controls[1];
		if (first === undefined || last === undefined) throw new Error("Missing dialog controls.");
		expect(document.activeElement).toBe(first);

		last.focus();
		await act(async () => {
			last.dispatchEvent(
				new KeyboardEvent("keydown", {
					bubbles: true,
					key: "Tab",
				}),
			);
		});
		expect(document.activeElement).toBe(first);

		await act(async () => {
			first.dispatchEvent(
				new KeyboardEvent("keydown", {
					bubbles: true,
					key: "Escape",
				}),
			);
		});
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		expect(document.activeElement).toBe(open);

		await act(async () => root.unmount());
		container.remove();
	});
});
