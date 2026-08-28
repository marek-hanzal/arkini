// @vitest-environment jsdom

import type { PropsWithChildren } from "react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	editorGameBoardViewTransitionName,
	gameBoardViewTransitionName,
} from "~/ui/navigation/gameBoardViewTransitionName";
import { launcherBackdropViewTransitionName } from "~/ui/navigation/launcherBackdropViewTransitionName";
import { PlayableGameShell } from "~/ui/shell/GameShell";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("~/ui/game/useGameEngine", () => ({
	useGameEngine: () => ({}),
}));

vi.mock("~/ui/game-menu/GameMenuProvider", () => ({
	GameMenuProvider: ({ children }: PropsWithChildren) => children,
}));

vi.mock("~/ui/item-detail/ItemDetailHigherOwnerGuard", () => ({
	ItemDetailHigherOwnerGuard: () => null,
}));

vi.mock("~/ui/item-detail/ItemDetailModal", () => ({
	ItemDetailModal: () => null,
}));

vi.mock("~/ui/item-detail/ItemDetailProvider", () => ({
	ItemDetailProvider: ({ children }: PropsWithChildren) => children,
}));

vi.mock("~/ui/pixi/PixiGameProvider", () => ({
	PixiGameProvider: ({ children }: PropsWithChildren) => children,
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

const renderShell = async (
	routePresentation: "embedded" | "embedded-transition" | "fullscreen",
) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				PlayableGameShell,
				{
					routePresentation,
				},
				createElement("div"),
			),
		);
	});
	return container;
};

afterEach(() => {
	act(() => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("PlayableGameShell", () => {
	it("publishes Board route surfaces for fullscreen gameplay", async () => {
		const container = await renderShell("fullscreen");

		expect(
			container.querySelector<HTMLElement>('[data-ui="GameSceneBackdrop"]')?.style
				.viewTransitionName,
		).toBe(launcherBackdropViewTransitionName);
		expect(
			container.querySelector<HTMLElement>('[data-ui="TileScene"]')?.style.viewTransitionName,
		).toBe(gameBoardViewTransitionName);
	});

	it("leaves embedded gameplay inside its parent route surface", async () => {
		const container = await renderShell("embedded");

		expect(
			container.querySelector<HTMLElement>('[data-ui="GameSceneBackdrop"]')?.style
				.viewTransitionName,
		).toBe("");
		expect(
			container.querySelector<HTMLElement>('[data-ui="TileScene"]')?.style.viewTransitionName,
		).toBe("");
	});

	it("names only the gameplay leaf for routed embedded Board and Inventory", async () => {
		const container = await renderShell("embedded-transition");

		expect(
			container.querySelector<HTMLElement>('[data-ui="GameSceneBackdrop"]')?.style
				.viewTransitionName,
		).toBe("");
		expect(
			container.querySelector<HTMLElement>('[data-ui="TileScene"]')?.style.viewTransitionName,
		).toBe(editorGameBoardViewTransitionName);
	});
});
