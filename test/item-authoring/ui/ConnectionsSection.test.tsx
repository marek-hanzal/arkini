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
					description: "Consumes the selected item.",
					title: "Consumer",
					type: "simple",
					uid: "consumer-uid",
				},
				peer: {
					asset: {
						default: [],
					},
					description: "Also consumes the selected item.",
					id: "peer",
					title: "Peer",
					type: "simple",
					uid: "peer-uid",
				},
				unrelated: {
					asset: {
						default: [],
					},
					description: "Not connected.",
					id: "unrelated",
					title: "Unrelated",
					type: "simple",
					uid: "unrelated-uid",
				},
			},
		},
		projectId: "project-one",
	}),
}));

vi.mock("~/translation/ui/useTranslator", () => ({
	useTranslator: () => ({
		textFn: (label: string) => label,
	}),
}));

vi.mock("~/item-authoring/fn/readItemConnectionsFn", () => ({
	readItemConnectionsFn: () => [
		{
			asset: {
				default: [],
			},
			description: "Consumes the selected item.",
			id: "consumer",
			title: "Consumer",
			type: "simple",
			uid: "consumer-uid",
		},
		{
			asset: {
				default: [],
			},
			description: "Also consumes the selected item.",
			id: "peer",
			title: "Peer",
			type: "simple",
			uid: "peer-uid",
		},
	],
}));

vi.mock("~/editor-control/ui/EditorSearchCombobox", () => ({
	EditorSearchCombobox: ({
		onChangeFn,
		options,
	}: {
		onChangeFn: (itemId: string) => void;
		options: ReadonlyArray<{
			readonly id: string;
		}>;
	}) =>
		createElement(
			"button",
			{
				"data-options": options.map(({ id }) => id).join(","),
				"data-ui": "ConnectionSearch",
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
	it("searches only the active connection list and preserves the filter through result navigation", async () => {
		const onFilterChangeFn = vi.fn();
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
				/>,
			);
		});

		const search = container.querySelector<HTMLButtonElement>('[data-ui="ConnectionSearch"]');
		expect(search?.dataset.options).toBe("consumer,peer");
		expect(container.querySelectorAll('[data-ui="EditorItemConnectionsRow"]')).toHaveLength(2);
		await act(async () => {
			search?.click();
		});
		expect(container.querySelectorAll('[data-ui="EditorItemConnectionsRow"]')).toHaveLength(1);

		await act(async () => {
			container.querySelector<HTMLButtonElement>('[data-ui="ConnectionFilter"]')?.click();
		});
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
