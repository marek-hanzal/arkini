// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

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
	vi.useRealTimers();
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
	it("clears a related-term selection and allows selecting another authored entry", async () => {
		vi.useFakeTimers();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				<EditorCollectionSelector
					count={2}
					initialSelectedIndex={null}
					clearSelectionLabel="Clear filter"
					unselectedContent={<div data-ui="AllLines">All lines</div>}
					itemLabelFn={(index) =>
						[
							"Workshop",
							"Foundry",
						][index]
					}
					itemRelatedSearchTermsFn={(index) =>
						index === 1
							? [
									"Copper",
								]
							: []
					}
					label="Production lines"
				>
					{(index) => <div data-ui="SelectedLine">{index}</div>}
				</EditorCollectionSelector>,
			);
		});
		const input = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (input === null) throw new Error("Expected collection search input.");
		expect(input.value).toBe("");
		expect(container.querySelector('[data-ui="AllLines"]')).not.toBeNull();
		await act(async () => input.click());
		await changeInput(input, "copper");
		await act(async () => vi.advanceTimersByTime(250));
		const option = document.querySelector<HTMLElement>(
			'[data-ui="EditorSearchComboboxOption"]',
		);
		if (option === null) throw new Error("Expected related-item search result.");
		await act(async () => option.click());
		expect(container.querySelector('[data-ui="SelectedLine"]')?.textContent).toBe("1");
		expect(container.querySelectorAll('[data-ui="SelectedLine"]')).toHaveLength(1);
		const clear = container.querySelector<HTMLButtonElement>('button[title="Clear filter"]');
		if (clear === null) throw new Error("Expected clear filter button.");
		await act(async () => clear.click());
		expect(input.value).toBe("");
		expect(container.querySelector('[data-ui="SelectedLine"]')).toBeNull();
		expect(container.querySelector('[data-ui="AllLines"]')).not.toBeNull();
		expect(clear.disabled).toBe(true);

		await act(async () => input.click());
		await act(async () => vi.advanceTimersByTime(250));
		const options = document.querySelectorAll<HTMLElement>(
			'[data-ui="EditorSearchComboboxOption"]',
		);
		expect(options).toHaveLength(2);
		await act(async () => options[0].click());
		expect(container.querySelector('[data-ui="SelectedLine"]')?.textContent).toBe("0");
		expect(container.querySelector('[data-ui="AllLines"]')).toBeNull();
		expect(clear.disabled).toBe(false);
	});
});
