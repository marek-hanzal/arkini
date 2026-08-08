// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useEditorEditShortcut } from "~/ui/editor/useEditorEditShortcut";

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

const Harness = ({ onEdit }: { readonly onEdit: () => void }) => {
	const editActionRef = useEditorEditShortcut();
	return createElement(
		"div",
		null,
		createElement("input"),
		createElement(
			"a",
			{
				href: "#edit",
				onClick: (event) => {
					event.preventDefault();
					onEdit();
				},
				ref: editActionRef,
			},
			"Edit",
		),
	);
};

const mount = async (onEdit: () => void) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () =>
		root.render(
			createElement(Harness, {
				onEdit,
			}),
		),
	);
	return container;
};

describe("useEditorEditShortcut", () => {
	it("clicks the mounted edit action for an unmodified E key", async () => {
		const onEdit = vi.fn();
		await mount(onEdit);

		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "e",
			}),
		);

		expect(onEdit).toHaveBeenCalledOnce();
	});

	it("does not steal E while typing or using a modifier", async () => {
		const onEdit = vi.fn();
		const container = await mount(onEdit);
		const input = container.querySelector("input");
		if (input === null) throw new Error("Expected input.");

		input.dispatchEvent(
			new KeyboardEvent("keydown", {
				bubbles: true,
				key: "e",
			}),
		);
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "e",
				metaKey: true,
			}),
		);

		expect(onEdit).not.toHaveBeenCalled();
	});
});
