// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement, type ReactNode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/renderer/game/GameEngine";
import type { GameMenuControl } from "~/ui/game-menu/GameMenuControl";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { GameEngineContext } from "~/ui/game/GameEngineContext";
import type { ItemDetailControl } from "~/item-detail-frame/type/ItemDetailControl";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
import { PlayableGameShell } from "~/ui/shell/GameShell";

vi.mock("~/engine/item-detail/read/readItemDetailSourcesFx", () => ({
	readItemDetailSourcesFx: (props: unknown) => props,
}));

vi.mock("~/engine/item-detail/fn/resolveItemDetailTargetFn", () => ({
	resolveItemDetailTargetFn: ({
		itemId,
		requestedTab,
	}: {
		readonly itemId: string;
		readonly requestedTab?: string;
	}) => ({
		itemId,
		kind: "available",
		tab: requestedTab ?? "lines",
		tabs: [
			"lines",
			"info",
		],
	}),
}));

vi.mock("~/game-scene/ui/PixiGameRuntime", () => ({
	PixiGameProvider: ({ children }: { readonly children?: ReactNode }) => children,
}));

vi.mock("~/item-detail/ui/ItemDetailModal", () => ({
	ItemDetailModal: () => null,
}));

vi.mock("~/ui/game-menu/GameMenu", () => ({
	GameMenu: () => null,
}));

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const game = {
	config: {
		items: {},
	},
	getSnapshot: () => ({}),
	id: "game:shell-overlay-precedence",
	readOrThrow: (request: unknown) => request,
} as unknown as GameEngine;

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const ItemDetailProbe = ({
	onControl,
}: {
	readonly onControl: (control: ItemDetailControl) => void;
}) => {
	const control = useItemDetailControl();
	useEffect(
		() => onControl(control),
		[
			control,
			onControl,
		],
	);
	return null;
};

const GameMenuProbe = ({
	onControl,
}: {
	readonly onControl: (control: GameMenuControl) => void;
}) => {
	const control = useGameMenuControl();
	useEffect(
		() => onControl(control),
		[
			control,
			onControl,
		],
	);
	return null;
};

const renderShell = async () => {
	let itemDetail: ItemDetailControl | undefined;
	let gameMenu: GameMenuControl | undefined;
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				GameEngineContext.Provider,
				{
					value: game,
				},
				createElement(
					PlayableGameShell,
					{
						menu: createElement(GameMenuProbe, {
							onControl: (next) => {
								gameMenu = next;
							},
						}),
						routePresentation: "embedded",
					},
					createElement(ItemDetailProbe, {
						onControl: (next) => {
							itemDetail = next;
						},
					}),
				),
			),
		);
	});
	return {
		readGameMenu: () => {
			if (gameMenu === undefined) throw new Error("Missing Game Menu control.");
			return gameMenu;
		},
		readItemDetail: () => {
			if (itemDetail === undefined) throw new Error("Missing Item Detail control.");
			return itemDetail;
		},
	};
};

describe("Playable Game shell overlay precedence", () => {
	it("yields Item Detail to Game Menu without cancelling admitted work", async () => {
		const { readGameMenu, readItemDetail } = await renderShell();
		await act(async () => {
			Effect.runSync(
				readItemDetail().openItemDetailFx({
					itemId: "runtime:first",
					tab: "lines",
				}),
			);
		});
		const entering = readItemDetail().state;
		if (entering.phase !== "entering") throw new Error("Expected entering state.");
		await act(async () =>
			Effect.runSync(readItemDetail().completeEnterFx(entering.generation)),
		);

		let completeRun: (() => void) | undefined;
		const run = new Promise<void>((resolve) => {
			completeRun = resolve;
		});
		await act(async () => {
			readItemDetail().runPendingAction({
				action: "enqueue",
				failureMessage: "Start failed.",
				key: "line:runtime:first",
				run: Effect.promise(() => run),
			});
			readGameMenu().open();
			await Promise.resolve();
		});

		expect(readGameMenu().phase).toBe("entering");
		expect(readItemDetail().state).toMatchObject({
			phase: "exiting",
			restoreFocus: false,
		});
		expect(readItemDetail().readPendingAction("line:runtime:first")).toBe("enqueue");

		await act(async () => completeRun?.());
		await vi.waitFor(() =>
			expect(readItemDetail().readPendingAction("line:runtime:first")).toBeNull(),
		);
		expect(readItemDetail().state.phase).toBe("exiting");
	});
});
