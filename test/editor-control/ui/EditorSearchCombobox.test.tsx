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
	vi.useRealTimers();
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

it("coalesces typed searches, blocks stale selection, and cancels dismissed queries", async () => {
	vi.useFakeTimers();
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const onChangeFn = vi.fn();
	const onInputChangeFn = vi.fn();
	const renderPreviewFn = vi.fn(() => null);
	await act(async () =>
		root.render(
			<EditorSearchCombobox
				label="Item"
				emptyLabel="No items"
				value="alpha"
				onChangeFn={onChangeFn}
				onInputChangeFn={onInputChangeFn}
				renderPreviewFn={renderPreviewFn}
				options={[
					{
						id: "alpha",
						label: "Alpha",
						terms: [
							"alpha",
						],
					},
					{
						id: "beta",
						label: "Beta",
						terms: [
							"beta",
						],
					},
				]}
			/>,
		),
	);
	const input = container.querySelector<HTMLInputElement>('input[type="search"]');
	if (input === null) throw new Error("Expected search input.");
	const optionsFn = () =>
		Array.from(
			document.querySelectorAll<HTMLButtonElement>('[data-ui="EditorSearchComboboxOption"]'),
		);
	const keyFn = async (key: string) => {
		await act(async () =>
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key,
					bubbles: true,
					cancelable: true,
				}),
			),
		);
	};
	const advanceFn = async (duration: number) => {
		await act(async () => vi.advanceTimersByTime(duration));
	};
	await act(async () => input.click());
	await changeInput(input, "b");
	const previewCount = renderPreviewFn.mock.calls.length;
	await advanceFn(200);
	await changeInput(input, "be");
	await advanceFn(200);
	await changeInput(input, "beta");
	expect(input.value).toBe("beta");
	expect(optionsFn()).toHaveLength(2);
	expect(renderPreviewFn).toHaveBeenCalledTimes(previewCount);
	await keyFn("Enter");
	await act(async () => optionsFn()[0]?.click());
	expect(onChangeFn).not.toHaveBeenCalled();
	await advanceFn(249);
	expect(optionsFn()).toHaveLength(2);
	await advanceFn(1);
	expect(optionsFn()).toHaveLength(1);
	await keyFn("Enter");
	expect(onChangeFn).toHaveBeenCalledExactlyOnceWith("beta");
	expect(optionsFn()).toHaveLength(0);

	await act(async () => input.click());
	await changeInput(input, "alpha");
	await keyFn("Escape");
	expect(input.value).toBe("alpha");
	await act(async () => input.click());
	expect(input.value).toBe("");
	await advanceFn(300);
	expect(optionsFn()).toHaveLength(2);
	await changeInput(input, "beta");
	await advanceFn(250);
	expect(optionsFn()).toHaveLength(1);
	const clear = container.querySelector<HTMLButtonElement>('button[title="Clear search"]');
	if (clear === null) throw new Error("Expected clear button.");
	await act(async () => clear.click());
	expect(onInputChangeFn).toHaveBeenLastCalledWith("");
	expect(optionsFn()).toHaveLength(2);
});

it("keeps arrow navigation visible in the menu without stealing input focus or scrolling on hover", async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () =>
		root.render(
			<EditorSearchCombobox
				label="Item"
				emptyLabel="No items"
				value=""
				onChangeFn={() => undefined}
				renderPreviewFn={() => null}
				options={Array.from(
					{
						length: 5,
					},
					(_, index) => ({
						id: String(index),
						label: String(index),
						terms: [
							String(index),
						],
					}),
				)}
			/>,
		),
	);
	const input = container.querySelector<HTMLInputElement>('input[type="search"]');
	if (input === null) throw new Error("Expected search input.");
	await act(async () => input.focus());
	const options = Array.from(
		document.querySelectorAll<HTMLButtonElement>('[data-ui="EditorSearchComboboxOption"]'),
	);
	const menu = options[0]?.parentElement;
	if (menu === undefined || menu === null) throw new Error("Expected floating menu.");
	// A two-row viewport at a nonzero page position; each item takes 40px.
	Object.defineProperty(menu, "clientHeight", {
		value: 80,
	});
	Object.defineProperty(menu, "clientTop", {
		value: 1,
	});
	vi.spyOn(menu, "getBoundingClientRect").mockImplementation(() => new DOMRect(0, 100, 200, 82));
	options.forEach((option, index) => {
		vi.spyOn(option, "getBoundingClientRect").mockImplementation(
			() => new DOMRect(0, 101 + index * 40 - menu.scrollTop, 200, 40),
		);
	});
	const keyFn = async (key: string) => {
		await act(async () =>
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key,
					bubbles: true,
					cancelable: true,
				}),
			),
		);
	};
	await keyFn("ArrowDown");
	expect(menu.scrollTop).toBe(0);
	await keyFn("ArrowDown");
	expect(menu.scrollTop).toBe(40);
	await keyFn("ArrowDown");
	expect(menu.scrollTop).toBe(80);
	await keyFn("ArrowDown");
	expect(menu.scrollTop).toBe(120);
	await keyFn("ArrowDown"); // Wrap last to first.
	expect(menu.scrollTop).toBe(0);
	await keyFn("ArrowUp"); // Wrap first to last.
	expect(menu.scrollTop).toBe(120);
	await keyFn("ArrowUp");
	expect(menu.scrollTop).toBe(120);
	await keyFn("ArrowUp");
	expect(menu.scrollTop).toBe(80);
	await act(async () =>
		options[0]?.dispatchEvent(
			new MouseEvent("mouseover", {
				bubbles: true,
			}),
		),
	);
	expect(menu.scrollTop).toBe(80);
	expect(document.activeElement).toBe(input);
	expect(document.documentElement.scrollTop).toBe(0);
});

it("virtualizes a large picker and scrolls keyboard selection to an unmounted last result", async () => {
	const height = vi
		.spyOn(HTMLElement.prototype, "offsetHeight", "get")
		.mockImplementation(function (this: HTMLElement) {
			return this.dataset.ui === "EditorSearchComboboxMenu" ? 160 : 80;
		});
	const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(400);
	const scrollHeight = vi
		.spyOn(HTMLElement.prototype, "scrollHeight", "get")
		.mockReturnValue(84_008);
	const previousScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
	Object.defineProperty(HTMLElement.prototype, "scrollTo", {
		configurable: true,
		value: function (this: HTMLElement, options: ScrollToOptions) {
			this.scrollTop = options.top ?? 0;
			this.dispatchEvent(new Event("scroll"));
		},
	});
	try {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const onChangeFn = vi.fn();
		await act(async () =>
			root.render(
				<EditorSearchCombobox
					label="Item"
					emptyLabel="No items"
					value=""
					onChangeFn={onChangeFn}
					renderPreviewFn={() => null}
					options={Array.from(
						{
							length: 1000,
						},
						(_, index) => ({
							id: `item-${index}`,
							label: `Item ${index}`,
							terms: [
								`item-${index}`,
							],
						}),
					)}
				/>,
			),
		);
		const input = container.querySelector<HTMLInputElement>('input[type="search"]')!;
		await act(async () => input.focus());
		const optionsFn = () =>
			document.querySelectorAll<HTMLButtonElement>('[data-ui="EditorSearchComboboxOption"]');
		expect(optionsFn().length).toBeGreaterThan(0);
		expect(optionsFn().length).toBeLessThan(15);
		expect(
			[
				...optionsFn(),
			].some((option) => option.textContent === "Item 999"),
		).toBe(false);
		await act(async () =>
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "ArrowUp",
					bubbles: true,
				}),
			),
		);
		await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
		const active = document.querySelector<HTMLButtonElement>(
			'[data-ui="EditorSearchComboboxOption"][data-ui-active="true"]',
		);
		expect(active?.textContent).toBe("Item 999");
		expect(optionsFn().length).toBeLessThan(15);
		expect(document.activeElement).toBe(input);
		expect(document.documentElement.scrollTop).toBe(0);
		await act(async () =>
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
				}),
			),
		);
		expect(onChangeFn).toHaveBeenCalledExactlyOnceWith("item-999");
	} finally {
		height.mockRestore();
		width.mockRestore();
		scrollHeight.mockRestore();
		if (previousScrollTo === undefined)
			Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
		else Object.defineProperty(HTMLElement.prototype, "scrollTo", previousScrollTo);
	}
});
