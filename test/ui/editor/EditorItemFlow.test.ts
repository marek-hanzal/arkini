// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorItemFormPage } from "~/page/editor/EditorItemFormPage";
import { EditorItemTypePicker } from "~/ui/item/editor/EditorItemTypePicker";
import { EditorItemView } from "~/ui/item/editor/EditorItemView";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
	formProps: undefined as unknown,
	project: undefined as unknown,
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/ui/item/editor/EditorItemForm", () => ({
	EditorItemForm: (props: unknown) => {
		state.formProps = props;
		return createElement("output", {
			"data-ui": "EditorItemForm",
		});
	},
}));

vi.mock("~/ui/item/editor/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () =>
		createElement("span", {
			"data-ui": "EditorItemThumbnail",
		}),
}));

vi.mock("~/ui/button/Button", () => {
	const RenderLink = ({ children, params, search, to }: Record<string, unknown>) =>
		createElement(
			"a",
			{
				"data-params": JSON.stringify(params),
				"data-search": JSON.stringify(search),
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
const item = {
	uid: "stable-item-uid",
	id: "item:water",
	type: "simple",
	title: "Water",
	description: "Fresh water.",
	asset: {
		default: [
			"asset:water",
		],
	},
	tags: [],
	scope: "any",
	maxStackSize: 1,
} as const;

beforeEach(() => {
	state.formProps = undefined;
	state.project = {
		projectId: "editor-test",
		title: "Editor test",
		resources: [
			{
				id: "asset:water",
				bytes: new Uint8Array(),
			},
		],
		config: {
			items: {
				[item.id]: item,
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

const render = async (element: ReactNode) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(element);
	});
	return container;
};

describe("editor item flow", () => {
	it("opens canonical items in read-only view before offering the unified form", async () => {
		const container = await render(
			createElement(EditorItemView, {
				uid: item.uid,
			}),
		);
		const edit = container.querySelector<HTMLAnchorElement>(
			'[data-to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"]',
		);

		expect(container.textContent).toContain("Water");
		expect(container.textContent).toContain("Fresh water.");
		expect(edit?.dataset.params).toContain(item.uid);
		expect(edit?.dataset.params).toContain("identity");
	});

	it("passes both new and persisted items through one form page", async () => {
		await render(
			createElement(EditorItemFormPage, {
				uid: item.uid,
			}),
		);
		expect(state.formProps).toMatchObject({
			uid: item.uid,
		});

		await render(
			createElement(EditorItemFormPage, {
				itemType: "simple",
				uid: "new-item-uid",
			}),
		);
		expect(state.formProps).toMatchObject({
			itemType: "simple",
			uid: "new-item-uid",
		});
	});

	it("starts every new item type in the unified identity section", async () => {
		const container = await render(createElement(EditorItemTypePicker));
		const links = [
			...container.querySelectorAll<HTMLAnchorElement>(
				'[data-to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"]',
			),
		];

		expect(links).toHaveLength(8);
		expect(links.every((link) => link.dataset.params?.includes("identity"))).toBe(true);
		expect(links.every((link) => link.dataset.search?.includes("itemType"))).toBe(true);
	});
});
