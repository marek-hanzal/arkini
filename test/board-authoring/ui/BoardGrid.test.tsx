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

vi.mock("~/authoring-form/ui/useEditorItemSearchOptions", () => ({
	useEditorItemSearchOptions: () => ({
		items: {
			water: {
				artwork: {
					default: [],
				},
			},
		},
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

	it("commits a drag only when the pointer is released on a grid cell", async () => {
		const onCellsChangeFn = vi.fn();
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
					height={1}
					mode="edit"
					onCellsChangeFn={onCellsChangeFn}
					width={2}
				/>,
			);
		});
		const source = container.querySelector<HTMLElement>('[data-board-grid-cell][data-x="0"]');
		const target = container.querySelector<HTMLElement>('[data-board-grid-cell][data-x="1"]');
		if (source === null || target === null) throw new Error("Missing board cells.");
		const dispatchPointerFn = (element: EventTarget, type: string, clientX: number) => {
			const event = new MouseEvent(type, {
				altKey: true,
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX,
				clientY: 0,
			});
			Object.defineProperty(event, "pointerId", {
				value: 1,
			});
			element.dispatchEvent(event);
		};
		await act(async () => {
			dispatchPointerFn(source, "pointerdown", 0);
			dispatchPointerFn(target, "pointermove", 20);
			dispatchPointerFn(document.body, "pointerup", 30);
		});
		expect(onCellsChangeFn).not.toHaveBeenCalled();

		await act(async () => {
			dispatchPointerFn(source, "pointerdown", 0);
			dispatchPointerFn(target, "pointermove", 20);
			dispatchPointerFn(target, "pointerup", 20);
		});
		expect(onCellsChangeFn).toHaveBeenCalledOnce();
		expect(onCellsChangeFn).toHaveBeenCalledWith([
			{
				itemUid: "water",
				x: 1,
				y: 0,
			},
		]);
	});
});
