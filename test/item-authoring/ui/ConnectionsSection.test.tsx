// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			items: {
				consumer: {
					asset: {
						default: [],
					},
					id: "consumer",
					title: "Consumer",
					uid: "consumer-uid",
				},
			},
		},
		projectId: "project-one",
	}),
}));

vi.mock("~/item-authoring/fn/readItemConnectionsFn", () => ({
	readItemConnectionsFn: () => [
		{
			id: "consumer",
		},
	],
}));

vi.mock("~/authoring-form/ui/EditorItemAutocompleteField", () => ({
	EditorItemReferenceControl: ({ onChangeFn }: { onChangeFn: (itemId: string) => void }) =>
		createElement(
			"button",
			{
				"data-ui": "ItemPicker",
				onClick: () => onChangeFn("consumer"),
				type: "button",
			},
			"Pick",
		),
}));

vi.mock("~/editor-control/ui/EditorSelect", () => ({
	EditorSelect: ({ onChangeFn }: { onChangeFn: (filter: string) => void }) =>
		createElement(
			"button",
			{
				"data-ui": "ConnectionFilter",
				onClick: () => onChangeFn("produces"),
				type: "button",
			},
			"Filter",
		),
}));

vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () => createElement("span"),
}));

vi.mock("~/ui/ui/Button", () => ({
	ButtonLink: ({ children, params, search, to, ...props }: Record<string, unknown>) =>
		createElement(
			"a",
			{
				...props,
				"data-params": JSON.stringify(params),
				"data-search": JSON.stringify(search),
				"data-to": to,
			},
			children as ReactNode,
		),
}));

import { ConnectionsSection } from "~/item-authoring/ui/ConnectionsSection";

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

describe("ConnectionsSection", () => {
	it("binds both route inputs and preserves the filter through result navigation", async () => {
		const onFilterChangeFn = vi.fn();
		const onItemIdChangeFn = vi.fn();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				<ConnectionsSection
					filter="inputs"
					itemId="material"
					onFilterChangeFn={onFilterChangeFn}
					onItemIdChangeFn={onItemIdChangeFn}
				/>,
			);
		});

		await act(async () => {
			container.querySelector<HTMLButtonElement>('[data-ui="ItemPicker"]')?.click();
			container.querySelector<HTMLButtonElement>('[data-ui="ConnectionFilter"]')?.click();
		});

		expect(onItemIdChangeFn).toHaveBeenCalledWith("consumer");
		expect(onFilterChangeFn).toHaveBeenCalledWith("produces");
		const link = container.querySelector<HTMLAnchorElement>("a");
		expect(link?.dataset.to).toBe("/editor/$projectId/editor/items/$itemUid/detail/$sectionId");
		expect(JSON.parse(link?.dataset.params ?? "null")).toEqual({
			itemUid: "consumer-uid",
			projectId: "project-one",
			sectionId: "connections",
		});
		expect(JSON.parse(link?.dataset.search ?? "null")).toEqual({
			filter: "inputs",
		});
	});
});
