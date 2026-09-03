// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorSearchCombobox } from "~/editor-control/ui/EditorSearchCombobox";

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

const changeInput = async (input: HTMLInputElement, value: string) => {
	const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (valueSetter === undefined) throw new Error("Expected native input value setter.");
	await act(async () => {
		valueSetter.call(input, value);
		input.dispatchEvent(
			new Event("input", {
				bubbles: true,
			}),
		);
	});
};

describe("EditorSearchCombobox", () => {
	it("dismisses transient searches without changing the selected value", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const onChangeFn = vi.fn();
		await act(async () => {
			root.render(
				<EditorSearchCombobox
					emptyLabel="No assets"
					label="Asset"
					onChangeFn={onChangeFn}
					options={[
						{
							id: "avatar-01",
							label: "Avatar 01",
							terms: [
								"Avatar 01",
							],
						},
						{
							id: "avatar-02",
							label: "Avatar 02",
							terms: [
								"Avatar 02",
							],
						},
					]}
					renderPreviewFn={() => null}
					value="avatar-01"
				/>,
			);
		});

		const input = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (input === null) throw new Error("Expected asset search input.");

		await act(async () => input.click());
		await changeInput(input, "avatar-02");
		expect(document.querySelector('[data-ui="EditorSearchComboboxOption"]')).not.toBeNull();

		await act(async () => {
			document.body.dispatchEvent(
				new MouseEvent("pointerdown", {
					bubbles: true,
				}),
			);
		});
		expect(document.querySelector('[data-ui="EditorSearchComboboxOption"]')).toBeNull();
		expect(input.value).toBe("avatar-01");

		await act(async () => input.click());
		await changeInput(input, "avatar-02");
		await act(async () => {
			document.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Escape",
				}),
			);
		});
		expect(document.querySelector('[data-ui="EditorSearchComboboxOption"]')).toBeNull();
		expect(input.value).toBe("avatar-01");
		expect(onChangeFn).not.toHaveBeenCalled();
	});
});
