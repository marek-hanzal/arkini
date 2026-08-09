// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/ui/item/editor/EditorItemThumbnail", () => ({
	EditorItemThumbnail: ({ resourceIds }: { readonly resourceIds: ReadonlyArray<string> }) =>
		createElement("span", {
			"data-resource": resourceIds.join(","),
		}),
}));

vi.mock("~/ui/item/editor/useEditorItemSearchOptions", () => ({
	useEditorItemSearchOptions: () => ({
		items: {
			wood: {
				asset: {
					default: [
						"wood-image",
					],
				},
				maxStackSize: 3,
				title: "Wood",
			},
		},
	}),
}));

vi.mock("~/ui/project/editor/EditorProjectStartItemPicker", () => ({
	EditorProjectStartItemPicker: ({
		onClose,
		onSelect,
	}: {
		readonly onClose: () => void;
		readonly onSelect: (itemId: string) => void;
	}) =>
		createElement(
			"div",
			{
				"data-ui": "MockStartPicker",
			},
			createElement(
				"button",
				{
					onClick: () => {
						onSelect("wood");
						onClose();
					},
					type: "button",
				},
				"Choose wood",
			),
		),
}));

import { EditorProjectStartGrid } from "~/ui/project/editor/EditorProjectStartGrid";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const renderGrid = async ({
	cells = [],
	onDecrement = vi.fn(),
	onIncrement = vi.fn(),
	onMove = vi.fn(),
	onSet = vi.fn(),
}: {
	readonly cells?: ReadonlyArray<{
		readonly itemId: string;
		readonly quantity: number;
		readonly x: number;
		readonly y: number;
	}>;
	readonly onDecrement?: ReturnType<typeof vi.fn<(x: number, y: number) => void>>;
	readonly onIncrement?: ReturnType<typeof vi.fn<(x: number, y: number) => void>>;
	readonly onMove?: ReturnType<
		typeof vi.fn<(sourceX: number, sourceY: number, targetX: number, targetY: number) => void>
	>;
	readonly onSet?: ReturnType<typeof vi.fn<(x: number, y: number, itemId: string) => void>>;
} = {}) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			<EditorProjectStartGrid
				cells={cells}
				height={1}
				onDecrement={onDecrement}
				onIncrement={onIncrement}
				onMove={onMove}
				onSet={onSet}
				scope="board"
				width={2}
			/>,
		);
	});
	return {
		container,
		onDecrement,
		onIncrement,
		onMove,
		onSet,
	};
};

const dispatchPointer = (
	target: EventTarget,
	type: "pointerdown" | "pointermove" | "pointerup",
	{
		altKey = false,
		clientX = 0,
		clientY = 0,
		metaKey = false,
		pointerId = 1,
	}: {
		readonly altKey?: boolean;
		readonly clientX?: number;
		readonly clientY?: number;
		readonly metaKey?: boolean;
		readonly pointerId?: number;
	} = {},
) => {
	const event = new MouseEvent(type, {
		altKey,
		bubbles: true,
		button: 0,
		cancelable: true,
		clientX,
		clientY,
		metaKey,
	});
	Object.defineProperty(event, "pointerId", {
		value: pointerId,
	});
	target.dispatchEvent(event);
};

describe("EditorProjectStartGrid", () => {
	it("opens the picker for an empty slot and assigns the selected item", async () => {
		const { container, onSet } = await renderGrid();
		const empty = container.querySelector<HTMLButtonElement>(
			'button[aria-label="Empty board slot 1, 1"]',
		);
		if (empty === null) throw new Error("Missing empty start slot.");

		await act(async () => empty.click());
		expect(container.querySelector('[data-ui="MockStartPicker"]')).not.toBeNull();
		const choose = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Choose wood",
		);
		if (choose === undefined) throw new Error("Missing mock picker option.");
		await act(async () => choose.click());

		expect(onSet).toHaveBeenCalledWith(0, 0, "wood");
		expect(container.querySelector('[data-ui="MockStartPicker"]')).toBeNull();
	});

	it.each([
		{
			label: "Alt",
			modifier: {
				altKey: true,
			},
		},
		{
			label: "Cmd",
			modifier: {
				metaKey: true,
			},
		},
	])("moves a whole stack with $label drag onto an occupied slot", async ({ modifier }) => {
		const onMove =
			vi.fn<(sourceX: number, sourceY: number, targetX: number, targetY: number) => void>();
		const onIncrement = vi.fn<(x: number, y: number) => void>();
		const { container } = await renderGrid({
			cells: [
				{
					itemId: "wood",
					quantity: 2,
					x: 0,
					y: 0,
				},
				{
					itemId: "wood",
					quantity: 3,
					x: 1,
					y: 0,
				},
			],
			onIncrement,
			onMove,
		});
		const source = container.querySelector<HTMLButtonElement>(
			'button[data-start-grid-cell][data-x="0"]',
		);
		const target = container.querySelector<HTMLButtonElement>(
			'button[data-start-grid-cell][data-x="1"]',
		);
		if (source === null || target === null) throw new Error("Missing drag fixture slots.");

		await act(async () => {
			dispatchPointer(source, "pointerdown", {
				...modifier,
				clientX: 10,
				clientY: 10,
			});
			dispatchPointer(target, "pointermove", {
				...modifier,
				clientX: 30,
				clientY: 10,
			});
		});

		expect(
			container.querySelector('[data-ui="EditorProjectStartGridDragPreview"]'),
		).not.toBeNull();
		expect(target.className).toContain("ring-2");

		await act(async () => {
			dispatchPointer(target, "pointerup", {
				clientX: 30,
				clientY: 10,
			});
		});

		expect(onMove).toHaveBeenCalledWith(0, 0, 1, 0);
		expect(onIncrement).not.toHaveBeenCalled();
		expect(container.querySelector('[data-ui="EditorProjectStartGridDragPreview"]')).toBeNull();
	});

	it("increments with left click, decrements with right click, and respects max stack", async () => {
		const callbacks = {
			onDecrement: vi.fn<(x: number, y: number) => void>(),
			onIncrement: vi.fn<(x: number, y: number) => void>(),
		};
		const { container } = await renderGrid({
			cells: [
				{
					itemId: "wood",
					quantity: 2,
					x: 0,
					y: 0,
				},
			],
			...callbacks,
		});
		const occupied = container.querySelector<HTMLButtonElement>(
			'button[aria-label="Wood, quantity 2"]',
		);
		if (occupied === null) throw new Error("Missing occupied start slot.");

		await act(async () => occupied.click());
		expect(callbacks.onIncrement).toHaveBeenCalledWith(0, 0);

		await act(async () => {
			occupied.dispatchEvent(
				new MouseEvent("contextmenu", {
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(callbacks.onDecrement).toHaveBeenCalledWith(0, 0);

		callbacks.onIncrement.mockClear();
		const full = await renderGrid({
			cells: [
				{
					itemId: "wood",
					quantity: 3,
					x: 0,
					y: 0,
				},
			],
			onIncrement: callbacks.onIncrement,
		});
		const fullSlot = full.container.querySelector<HTMLButtonElement>(
			'button[aria-label="Wood, quantity 3"]',
		);
		if (fullSlot === null) throw new Error("Missing full start stack.");
		await act(async () => fullSlot.click());
		expect(callbacks.onIncrement).not.toHaveBeenCalled();
	});
});
