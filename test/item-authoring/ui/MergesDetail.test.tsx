// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";

const project = {
	config: editorTestConfig,
	projectId: "project-one",
};

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => project,
}));

vi.mock("~/editor-control/ui/EditorInfoTooltip", () => ({
	EditorInfoTooltip: () => createElement("span"),
}));

vi.mock("~/item-authoring/ui/DetailReference", () => ({
	DetailReference: ({ itemId }: { readonly itemId: string }) =>
		createElement("span", null, itemId),
}));

vi.mock("~/item-authoring/ui/SelectorDetail", () => ({
	SelectorDetail: () => createElement("span"),
}));

vi.mock("~/item-authoring/ui/OutputDetail", () => ({
	OutputDetail: () => createElement("span"),
}));

vi.mock("~/ui/ui/Button", () => ({
	ButtonLink: ({
		children,
		params,
		search,
		to,
		...props
	}: {
		readonly children?: ReactNode;
		readonly params?: unknown;
		readonly search?: unknown;
		readonly to?: unknown;
	}) =>
		createElement(
			"a",
			{
				...props,
				"data-params": JSON.stringify(params),
				"data-search": JSON.stringify(search),
				"data-to": to,
			},
			children,
		),
	PrimaryButtonLink: ({ children }: { readonly children?: ReactNode }) =>
		createElement("a", null, children),
}));

import { MergesDetail } from "~/item-authoring/ui/CapabilityDetails";

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

describe("MergesDetail", () => {
	it("opens the matching authored merge in the item form", async () => {
		const item: ItemSchema.Type = {
			...editorTestConfig.items.water,
			merge: [
				{
					action: "consume",
					effect: "keep",
					target: {
						itemId: "water",
						type: "item",
					},
				},
				{
					action: "use",
					effect: "remove",
					target: {
						itemId: "water",
						type: "item",
					},
				},
			],
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(<MergesDetail item={item} />);
		});

		const links = Array.from(
			container.querySelectorAll<HTMLAnchorElement>(
				'[data-ui="EditorItemMergeDetailEditLink"]',
			),
		);
		expect(links).toHaveLength(2);
		for (const [index, link] of links.entries()) {
			expect(link.dataset.to).toBe(
				"/editor/$projectId/editor/items/$itemUid/form/$sectionId",
			);
			expect(JSON.parse(link.dataset.params ?? "null")).toEqual({
				itemUid: item.uid,
				projectId: project.projectId,
				sectionId: "merges",
			});
			expect(JSON.parse(link.dataset.search ?? "null")).toEqual({
				merge: index,
			});
		}
	});
});
