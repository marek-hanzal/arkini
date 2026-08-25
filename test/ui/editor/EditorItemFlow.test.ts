// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorItemFormPage } from "~/page/editor/EditorItemFormPage";
import { EditorItemDetail } from "~/ui/item/editor/EditorItemDetail";
import { EditorItemDetailSectionPage } from "~/ui/item/editor/EditorItemDetailSectionPage";
import { EditorItemTypePicker } from "~/ui/item/editor/EditorItemTypePicker";

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
		Button: ({ children, ...props }: Record<string, unknown>) =>
			createElement("button", props, children as ReactNode),
		ButtonLink: RenderLink,
		PrimaryButtonLink: RenderLink,
	};
});

vi.mock("~/ui/editor/EditorHistoryBackButton", () => ({
	EditorHistoryBackButton: ({ children }: { readonly children?: ReactNode }) =>
		createElement("span", null, children),
}));

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
	it("opens canonical items in a sectioned read-only detail before offering the form", async () => {
		const container = await render(
			createElement(
				EditorItemDetail,
				{
					sectionId: "identity",
					uid: item.uid,
				},
				createElement(EditorItemDetailSectionPage, {
					sectionId: "identity",
					uid: item.uid,
				}),
			),
		);
		const edit = container.querySelector<HTMLAnchorElement>(
			'[data-to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"]',
		);

		expect(container.textContent).toContain("Water");
		expect(container.textContent).toContain("Fresh water.");
		expect(container.textContent).toContain("Simple item");
		expect(container.textContent).toContain("Board, Inventory & Toolbar");
		expect(container.textContent).toContain("Single item");
		expect(container.querySelectorAll('[data-ui="EditorItemDetailCard"]')).toHaveLength(1);
		expect(container.textContent).not.toContain('"maxStackSize"');
		expect(edit?.dataset.params).toContain(item.uid);
		expect(edit?.dataset.params).toContain("identity");
		expect(container.textContent).toContain("Convert");
		const flowLinks = [
			...container.querySelectorAll<HTMLAnchorElement>('[data-to="/editor/$projectId/flow"]'),
		];
		expect(flowLinks.map((link) => link.textContent)).toEqual([
			"Inputs",
			"Outputs",
		]);
		expect(flowLinks.map((link) => JSON.parse(link.dataset.search ?? "{}"))).toEqual([
			{
				direction: "input",
				itemId: item.id,
			},
			{
				direction: "output",
				itemId: item.id,
			},
		]);
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

	it("presents nested production data without a raw-definition escape hatch", async () => {
		const bucket = {
			...item,
			uid: "bucket-uid",
			id: "item:bucket",
			title: "Bucket",
		} as const;
		const producer = {
			...item,
			uid: "producer-uid",
			id: "producer:well",
			type: "producer",
			title: "Well",
			maxQueueSize: 2,
			lines: [
				{
					id: "line:water",
					title: "Draw water",
					description: "Produces water.",
					default: true,
					show: true,
					enable: true,
					runtimeMs: 500,
					input: [
						{
							type: "materials",
							selector: {
								type: "item",
								itemId: "item:bucket",
							},
							mode: "reserve",
							quantity: {
								min: 1,
								max: 1,
							},
							capacity: 0,
						},
					],
					output: {
						set: [
							{
								roll: [
									{
										type: "chance",
										chance: 0.5,
										drop: [
											{
												itemId: "item:water",
												quantity: {
													min: 1,
													max: 1,
												},
												placement: "drop",
												rules: [],
											},
										],
									},
								],
							},
						],
					},
					rules: [],
				},
			],
		} as const;
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
					[bucket.id]: bucket,
					[producer.id]: producer,
					[item.id]: item,
				},
			},
		};
		const container = await render(
			createElement(
				EditorItemDetail,
				{
					sectionId: "production",
					uid: producer.uid,
				},
				createElement(EditorItemDetailSectionPage, {
					sectionId: "production",
					uid: producer.uid,
				}),
			),
		);

		expect(container.textContent).toContain("Draw water");
		expect(container.textContent).toContain("Produces water.");
		expect(container.textContent).toContain("Runtime");
		expect(container.textContent).toContain("0.5 s");
		expect(container.textContent).toContain("Inputs");
		expect(container.textContent).toContain("Bucket");
		expect(container.textContent).toContain("×1 required");
		expect(container.textContent).toContain("Outputs");
		expect(container.textContent).toContain("50% chance");
		expect(container.textContent).toContain("Water");
		expect(container.querySelector('[data-ui="EditorProductionLineDetail"]')).not.toBeNull();
		expect(
			container.querySelector('[data-ui="EditorProductionLineFlowChevron"]'),
		).not.toBeNull();
		expect(container.querySelector('[data-ui="TileLineProgress"]')).toBeNull();
		expect(container.querySelector('[data-ui="TileLineEnqueueButton"]')).toBeNull();
		expect(container.querySelector('[data-ui="TileLineSetDefaultButton"]')).toBeNull();
		expect(container.querySelector('[data-ui="EditorItemDetailCard"]')).toBeNull();
		expect(container.querySelector("pre")).toBeNull();
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
