// @vitest-environment jsdom

import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { EditorCollectionTabs } from "~/ui/form/EditorCollectionTabs";

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
	return createElement(EditorCollectionTabs, {
		addLabel: "Add entry",
		children: (index: number) => createElement("output", null, items[index]),
		count: items.length,
		itemLabel: (index) => `Entry ${index + 1}`,
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

describe("EditorCollectionTabs", () => {
	it("selects one item while keeping sibling forms out of the DOM", async () => {
		const container = await mount();
		expect(container.querySelector("output")?.textContent).toBe("First");

		await click(container, "Entry 2");
		expect(container.querySelector("output")?.textContent).toBe("Second");
		expect(container.querySelectorAll("output")).toHaveLength(1);
	});

	it("selects a newly added item and clamps selection after removal", async () => {
		const container = await mount();
		await click(container, "Add entry");
		expect(container.querySelector("output")?.textContent).toBe("Entry 3");

		await click(container, "Remove active");
		expect(container.querySelector("output")?.textContent).toBe("Second");
	});
});
