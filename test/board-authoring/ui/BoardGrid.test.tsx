// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () =>
		createElement("span", {
			"data-ui": "EditorItemThumbnail",
		}),
}));

vi.mock("~/ui/ui/Button", () => ({
	ButtonLink: ({ children, params, to, ...props }: Record<string, unknown>) =>
		createElement(
			"a",
			{
				...props,
				"data-params": JSON.stringify(params),
				"data-to": to,
			},
			children as ReactNode,
		),
}));

import { BoardGrid } from "~/board-authoring/ui/BoardGrid";
import { boardSpaceProject } from "~test/project-authoring/support/BoardSpaceProject";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	vi.restoreAllMocks();
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("BoardGrid", () => {
	it("keeps detail mode independent from edit context and drag lifecycle", async () => {
		const addWindowListenerFn = vi.spyOn(window, "addEventListener");
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				<BoardGrid
					cells={[
						{
							itemUid: "water",
							x: 0,
							y: 0,
						},
					]}
					height={2}
					items={boardSpaceProject.config.items}
					mode="detail"
					projectId={boardSpaceProject.projectId}
					width={2}
				/>,
			);
		});

		expect(
			container.querySelector('[data-ui="EditorBoardGrid"]')?.getAttribute("data-mode"),
		).toBe("detail");
		expect(container.querySelectorAll('[data-ui="EditorBoardGridSlot"]')).toHaveLength(4);
		expect(container.querySelector('[data-ui="EditorItemThumbnail"]')).not.toBeNull();
		const itemLink = container.querySelector<HTMLAnchorElement>(
			'a[data-ui="EditorBoardGridSlot"]',
		);
		expect(itemLink?.dataset.to).toBe(
			"/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
		);
		expect(JSON.parse(itemLink?.dataset.params ?? "null")).toEqual({
			itemUid: boardSpaceProject.config.items.water?.uid,
			projectId: boardSpaceProject.projectId,
			sectionId: "identity",
		});
		expect(container.querySelectorAll('div[data-ui="EditorBoardGridSlot"]')).toHaveLength(3);
		expect(
			addWindowListenerFn.mock.calls.filter(([type]) =>
				[
					"blur",
					"pointercancel",
					"pointermove",
					"pointerup",
				].includes(type),
			),
		).toHaveLength(0);
	});
});
