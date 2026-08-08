// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	project: undefined as unknown,
	usages: [] as ReadonlyArray<Record<string, unknown>>,
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/bridge/resource/editor/useEditorResourceUsages", () => ({
	useEditorResourceUsages: () => state.usages,
}));

vi.mock("~/ui/button/Button", () => {
	const RenderLink = ({ children, params, to }: Record<string, unknown>) =>
		createElement(
			"a",
			{
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

import { EditorAssetDetail } from "~/ui/resource/editor/EditorAssetDetail";
import { EditorAssetUsage } from "~/ui/resource/editor/EditorAssetUsage";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	state.project = {
		projectId: "editor-test",
		resources: [
			{
				id: "item-water",
				mime: "image/png",
				bytes: new Uint8Array([
					1,
					2,
					3,
				]),
			},
		],
	};
	state.usages = [];
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const render = async (node: ReactNode) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => root.render(node));
	return container;
};

describe("editor asset detail", () => {
	it("owns one root card around the active detail section", async () => {
		const container = await render(
			createElement(
				EditorAssetDetail,
				{
					filter: "all",
					query: "",
					resourceId: "item-water",
				},
				createElement("span", null, "Overview body"),
			),
		);

		expect(container.querySelectorAll('[data-ui="EditorAssetDetailCard"]')).toHaveLength(1);
		expect(container.querySelector('[data-ui="EditorAssetDetailCard"]')?.textContent).toContain(
			"Overview body",
		);
	});

	it("distinguishes an unused asset from saved item references", async () => {
		let container = await render(
			createElement(EditorAssetUsage, {
				resourceId: "item-water",
			}),
		);
		expect(container.querySelector('[data-ui="EditorAssetUnused"]')).not.toBeNull();
		expect(container.textContent).toContain("This asset is not used");

		state.usages = [
			{
				resourceId: "item-water",
				owner: "item",
				ownerId: "water",
				ownerUid: "water-uid",
				ownerLabel: "Water",
				roleLabel: "Default artwork 1",
			},
		];
		container = await render(
			createElement(EditorAssetUsage, {
				resourceId: "item-water",
			}),
		);
		expect(container.textContent).toContain("Water");
		expect(container.textContent).toContain("Default artwork 1");
		const link = container.querySelector("a");
		expect(link?.dataset.to).toBe("/editor/$projectId/editor/items/$itemUid/detail/$sectionId");
		expect(link?.dataset.params).toContain("artwork");
		expect(link?.dataset.params).toContain("water-uid");
	});
});
