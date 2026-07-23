// @vitest-environment jsdom

import { act, createElement, Fragment } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TileGridFrame } from "~/ui/tile/TileGridFrame";
import { TileGridFrame as GridFrame } from "~/ui/tile/TileGridFrame";
import type { TileSurface } from "~/ui/tile/TileSurface";

const renderState = vi.hoisted(() => ({
	counts: new Map<string, number>(),
}));

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));

vi.mock("~/ui/tile/useTileSlot", () => ({
	useTileSlot: ({
		surface,
		slot,
	}: {
		readonly surface: TileSurface;
		readonly slot: {
			readonly id: string;
		};
	}) => {
		const key = `${surface.id}:${slot.id}`;
		renderState.counts.set(key, (renderState.counts.get(key) ?? 0) + 1);
		return {
			ref: () => undefined,
			over: false,
		};
	},
}));

vi.mock("~/ui/tile/useTileSurface", () => ({
	useTileSurface: () => () => undefined,
}));

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

const boardSurface = {
	id: "board:0",
	kind: "board",
	space: 0,
} satisfies TileSurface;
const toolbarSurface = {
	id: "toolbar",
	kind: "toolbar",
} satisfies TileSurface;

const createCells = (
	width: number,
	height: number,
	revisions: ReadonlyMap<number, string>,
): ReadonlyArray<TileGridFrame.Cell> =>
	Array.from(
		{
			length: width * height,
		},
		(_, index) => ({
			index,
			x: index % width,
			y: Math.floor(index / width),
			occupant:
				index % 7 === 0
					? {
							id: `runtime:${index}`,
							revision: revisions.get(index) ?? `revision:${index}`,
						}
					: null,
		}),
	);

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	renderState.counts.clear();
	document.body.replaceChildren();
});

describe("Tile grid render boundary", () => {
	it("keeps rebuilt Board and Toolbar snapshots local to the exact changed occupant", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		const render = async (changedBoardRevision?: string) => {
			const boardCells = createCells(
				11,
				11,
				new Map(
					changedBoardRevision === undefined
						? []
						: [
								[
									14,
									changedBoardRevision,
								],
							],
				),
			);
			const toolbarCells = createCells(9, 1, new Map());
			await act(async () => {
				root.render(
					createElement(
						Fragment,
						null,
						createElement(GridFrame, {
							surface: {
								...boardSurface,
							},
							width: 11,
							height: 11,
							cells: boardCells,
							frameUi: "BoardFrame",
							gridUi: "BoardGrid",
							cellUi: "BoardCell",
						}),
						createElement(GridFrame, {
							surface: {
								...toolbarSurface,
							},
							width: 9,
							height: 1,
							cells: toolbarCells,
							frameUi: "ToolbarFrame",
							gridUi: "ToolbarGrid",
							cellUi: "ToolbarCell",
						}),
					),
				);
			});
		};

		await render();
		expect(renderState.counts.size).toBe(130);
		expect(new Set(renderState.counts.values())).toEqual(
			new Set([
				1,
			]),
		);

		await render();
		expect(new Set(renderState.counts.values())).toEqual(
			new Set([
				1,
			]),
		);

		await render("revision:quarry-transition");
		for (const [key, renders] of renderState.counts) {
			expect(renders, key).toBe(key === "board:0:3:1" ? 2 : 1);
		}
	});
});
