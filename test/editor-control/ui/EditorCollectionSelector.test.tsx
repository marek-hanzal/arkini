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
	it("keeps empty collection controls visible while only add remains enabled", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const addFn = vi.fn();
		const removeFn = vi.fn();
		await act(async () => {
			root.render(
				<EditorCollectionSelector
					addLabel="Add line"
					count={0}
					itemLabelFn={() => "Line"}
					label="Production lines"
					onAddFn={addFn}
					onRemoveFn={removeFn}
					removeLabel="Remove line"
				>
					{() => null}
				</EditorCollectionSelector>,
			);
		});

		const input = container.querySelector<HTMLInputElement>('input[type="search"]');
		const add = container.querySelector<HTMLButtonElement>('button[title="Add line"]');
		const remove = container.querySelector<HTMLButtonElement>('button[title="Remove line"]');
		expect(input?.disabled).toBe(true);
		expect(add?.disabled).toBe(false);
		expect(remove?.disabled).toBe(true);

		await act(async () => add?.click());
		expect(addFn).toHaveBeenCalledOnce();
		expect(removeFn).not.toHaveBeenCalled();
	});

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
	it("keeps one selected entry while searching related terms and switching entries", async () => {
		vi.useFakeTimers();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				<EditorCollectionSelector
					count={2}
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
		expect(input.value).toBe("Workshop");
		expect(container.querySelector('[data-ui="SelectedLine"]')?.textContent).toBe("0");
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

		await act(async () => input.click());
		await act(async () => vi.advanceTimersByTime(250));
		const options = document.querySelectorAll<HTMLElement>(
			'[data-ui="EditorSearchComboboxOption"]',
		);
		expect(options).toHaveLength(2);
		await act(async () => options[0].click());
		expect(container.querySelector('[data-ui="SelectedLine"]')?.textContent).toBe("0");
		expect(container.querySelectorAll('[data-ui="SelectedLine"]')).toHaveLength(1);
	});
});
