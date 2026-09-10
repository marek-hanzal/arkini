// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";

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

describe("EditorCollectionSelector", () => {
	it("keeps technical identities searchable without displaying them", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				<EditorCollectionSelector
					count={1}
					itemLabelFn={() => "Output set 1 — Spoiled Rum Barrel"}
					itemSearchTermsFn={() => [
						"spoiled-rum-barrel",
					]}
					label="Output sets"
				>
					{() => null}
				</EditorCollectionSelector>,
			);
		});

		const input = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (input === null) throw new Error("Expected collection search input.");
		expect(input.value).toBe("Output set 1 — Spoiled Rum Barrel");

		await act(async () => input.click());
		await changeInput(input, "spoiled-rum-barrel");
		const option = document.querySelector('[data-ui="EditorSearchComboboxOption"]');
		expect(option?.textContent).toBe("Output set 1 — Spoiled Rum Barrel");
	});
});
