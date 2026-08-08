// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorItemList } from "~/ui/item/editor/EditorItemList";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
	project: undefined as unknown,
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/ui/item/editor/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () =>
		createElement("span", {
			"data-ui": "EditorItemThumbnail",
		}),
}));

vi.mock("~/ui/button/Button", () => {
	const RenderLink = ({ children, className, params, to }: Record<string, unknown>) =>
		createElement(
			"a",
			{
				className,
				"data-params": JSON.stringify(params),
				"data-to": to,
			},
			children as ReactNode,
		);
	return {
		ButtonLink: RenderLink,
		PrimaryButtonLink: RenderLink,
	};
});

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	const createItem = ({
		id,
		title,
		type,
	}: {
		readonly id: string;
		readonly title: string;
		readonly type: "deposit" | "producer" | "simple";
	}) => ({
		uid: id,
		id,
		title,
		type,
		description: `${title} description`,
		asset: {
			default: [
				`asset:${id}`,
			],
		},
	});
	state.project = {
		projectId: "editor-test",
		title: "Editor test",
		config: {
			items: {
				water: createItem({
					id: "water",
					title: "Water",
					type: "simple",
				}),
				well: createItem({
					id: "well",
					title: "Well",
					type: "deposit",
				}),
				bakery: createItem({
					id: "bakery",
					title: "Bakery",
					type: "producer",
				}),
			},
		},
	};
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const renderItemList = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(createElement(EditorItemList));
	});
	return container;
};

const setSearch = async (container: HTMLElement, value: string) => {
	const input = container.querySelector<HTMLInputElement>('[aria-label="Search items"]');
	if (input === null) throw new Error("Missing editor item search.");
	const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (setter === undefined) throw new Error("Missing native input value setter.");
	await act(async () => {
		setter.call(input, value);
		input.dispatchEvent(
			new Event("input", {
				bubbles: true,
			}),
		);
	});
};

const click = async (element: Element | null) => {
	if (!(element instanceof HTMLElement)) throw new Error("Missing clickable element.");
	await act(async () => {
		element.click();
	});
};

const readVisibleItemIds = (container: HTMLElement) =>
	[
		...container.querySelectorAll<HTMLElement>("[data-item-id]"),
	].map((row) => row.dataset.itemId);

describe("EditorItemList", () => {
	it("renders each item as one consistently padded interactive row", async () => {
		const container = await renderItemList();
		const row = container.querySelector<HTMLElement>('[data-ui="EditorItemRow"]');
		if (row === null) throw new Error("Missing item row.");

		expect(row.className).toContain("ak-list-row-interactive");
		expect(row.className).toContain("p-3");
		expect(row.querySelector(":scope > a")?.className).toContain("before:inset-0");
		expect(row.querySelector(":scope > button")?.className).toContain("relative z-10");
		expect(row.children).toHaveLength(2);
	});

	it("replaces the placeholder heading with shared Fuse search and a removable type filter", async () => {
		const container = await renderItemList();

		expect(container.textContent).not.toContain("source-backed items");
		expect(container.textContent).not.toContain("Item editing forms");
		expect(readVisibleItemIds(container)).toEqual([
			"bakery",
			"water",
			"well",
		]);

		await setSearch(container, "water");
		expect(readVisibleItemIds(container)).toEqual([
			"water",
		]);

		await setSearch(container, "");
		await click(container.querySelector('[aria-label="Filter items by deposit"]'));
		expect(readVisibleItemIds(container)).toEqual([
			"well",
		]);
		expect(container.querySelector('[data-ui="EditorItemTypeFilter"]')?.textContent).toContain(
			"deposit",
		);

		await setSearch(container, "bakery");
		expect(container.querySelector('[data-ui="EditorItemSearchEmpty"]')).not.toBeNull();

		await click(container.querySelector('[aria-label="Clear deposit item filter"]'));
		expect(readVisibleItemIds(container)).toEqual([
			"bakery",
		]);
	});

	it("renders the package-empty Status with one canonical New item action", async () => {
		state.project = {
			projectId: "editor-test",
			title: "Editor test",
			config: {
				items: {},
			},
		};
		const container = await renderItemList();

		expect(container.querySelector('[data-ui="EditorItemsEmpty"]')).not.toBeNull();
		expect(container.textContent).toContain("No items yet");
		expect(container.textContent).toContain(
			"Create the first item to start authoring this game.",
		);
		const newItemLinks = [
			...container.querySelectorAll("a"),
		].filter((link) => link.textContent === "New item");
		expect(newItemLinks).toHaveLength(1);
		expect(newItemLinks[0]?.dataset.to).toBe("/editor/$projectId/editor/items/new/select");
		expect(newItemLinks[0]?.dataset.params).toContain("editor-test");
		expect(container.querySelector('[aria-label="Search items"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="EditorItemSearchEmpty"]')).toBeNull();
	});
});
