// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorSearchCombobox } from "~/ui/form/EditorSearchCombobox";

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

describe("EditorSearchCombobox", () => {
	it("navigates matching options with arrows and chooses the active option", async () => {
		const onChange = vi.fn();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(EditorSearchCombobox, {
					label: "Item",
					emptyLabel: "Empty",
					options: [
						{
							id: "first",
							label: "First",
							meta: "simple",
							terms: [
								"First",
							],
						},
						{
							id: "second",
							label: "Second",
							meta: "simple",
							terms: [
								"Second",
							],
						},
					],
					value: "",
					onChange,
					renderPreview: () => null,
				}),
			);
		});
		const input = container.querySelector("input");
		if (input === null) throw new Error("Expected combobox input.");
		await act(async () => {
			input.focus();
		});
		await act(async () => {
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "ArrowDown",
					bubbles: true,
				}),
			);
		});
		await act(async () => {
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
				}),
			);
		});

		expect(onChange).toHaveBeenCalledWith("second");
		expect(input.getAttribute("aria-controls")).not.toBeNull();
	});

	it("uses a full-height custom clear action instead of the native search control", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(EditorSearchCombobox, {
					label: "Item",
					emptyLabel: "Empty",
					options: [],
					value: "selected-item",
					onChange: vi.fn(),
					renderPreview: () => null,
				}),
			);
		});
		const input = container.querySelector("input");
		const clear = container.querySelector<HTMLButtonElement>('button[title="Clear search"]');
		if (input === null || clear === null) throw new Error("Expected search clear action.");

		await act(async () => clear.click());

		expect(input.value).toBe("");
		expect(clear.className).toContain("inset-y-0");
	});
});
