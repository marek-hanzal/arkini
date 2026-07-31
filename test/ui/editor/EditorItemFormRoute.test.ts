// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorItemFormRoute } from "~/ui/item/editor/EditorItemFormRoute";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
	formProps: undefined as unknown,
	project: undefined as unknown,
	staged: {} as Readonly<Record<string, unknown>>,
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/bridge/editor/useEditorProjectDraft", () => ({
	useEditorProjectDraft: () => state.staged,
}));

vi.mock("~/ui/item/editor/EditorItemForm", () => ({
	EditorItemForm: (props: unknown) => {
		state.formProps = props;
		return createElement("output", null, "Item form");
	},
}));

vi.mock("~/ui/button/Button", () => ({
	ButtonLink: ({ children }: { readonly children?: ReactNode }) =>
		createElement("a", null, children),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	state.formProps = undefined;
	state.project = {
		projectId: "editor-test",
		config: {
			items: {},
		},
		itemSourcePaths: {},
	};
	state.staged = {};
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("EditorItemFormRoute", () => {
	it("resolves a staged item explicitly without publishing it as canonical project config", async () => {
		const item = {
			uid: "item:new",
			id: "item:new",
			type: "simple",
			title: "Staged item",
			description: "Staged item.",
			asset: {
				default: [
					"asset:test",
				],
			},
			tags: [],
			categoryId: "category:test",
			scope: "any",
			maxStackSize: 1,
		} as const;
		state.staged = {
			[item.id]: {
				item,
			},
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				createElement(EditorItemFormRoute, {
					mode: "edit",
					itemId: item.id,
				}),
			);
		});

		expect(container.textContent).toBe("Item form");
		expect(state.formProps).toMatchObject({
			item,
			itemType: "simple",
			sourceItemId: undefined,
			sourcePath: undefined,
		});
		expect(
			(state.project as { readonly config: { readonly items: Record<string, unknown> } }).config
				.items,
		).toEqual({});
	});
});
