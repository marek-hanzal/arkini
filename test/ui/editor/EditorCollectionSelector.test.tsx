// @vitest-environment jsdom

import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";

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

const Harness = () => {
	const [items, setItems] = useState([
		"First",
		"Second",
	]);
	return createElement(EditorCollectionSelector, {
		addLabel: "Add entry",
		children: (index: number) => createElement("output", null, items[index]),
		count: items.length,
		itemLabel: (index) => items[index],
		label: "Entries",
		onAdd: () =>
			setItems((current) => [
				...current,
				`Entry ${current.length + 1}`,
			]),
		onRemove: (index) =>
			setItems((current) => current.filter((_, itemIndex) => itemIndex !== index)),
		removeLabel: "Remove active",
	});
};

const mount = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => root.render(createElement(Harness)));
	return container;
};

const click = async (container: HTMLElement, label: string) => {
	const button = [
		...container.querySelectorAll("button"),
	].find((candidate) => candidate.textContent === label || candidate.title === label);
	if (button === undefined) throw new Error(`Expected ${label} button.`);
	await act(async () => button.click());
};

const select = async (container: HTMLElement, query: string) => {
	const element = container.querySelector("input");
	if (element === null) throw new Error("Expected collection search.");
	const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (valueSetter === undefined) throw new Error("Expected native input value setter.");
	await act(async () => {
		valueSetter.call(element, query);
		element.dispatchEvent(
			new Event("input", {
				bubbles: true,
			}),
		);
	});
	await act(async () => {
		element.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Enter",
				bubbles: true,
			}),
		);
	});
};

describe("EditorCollectionSelector", () => {
	it("selects one item while keeping sibling forms out of the DOM", async () => {
		const container = await mount();
		expect(container.querySelector("output")?.textContent).toBe("First");

		await select(container, "Second");
		expect(container.querySelector("output")?.textContent).toBe("Second");
		expect(container.querySelectorAll("output")).toHaveLength(1);
	});

	it("selects a newly added item and clamps selection after removal", async () => {
		const container = await mount();
		await click(container, "Add entry");
		expect(container.querySelector("output")?.textContent).toBe("Entry 3");
		expect(container.querySelector("input")?.value).toBe("Entry 3");

		await click(container, "Remove active");
		expect(container.querySelector("output")?.textContent).toBe("Second");
	});
});
