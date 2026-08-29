// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, vi } from "vitest";

import type { GameEngine } from "~/renderer/game/GameEngine";
import type { GameMenuControl } from "~/ui/game-menu/GameMenuControl";
import { GameMenuProvider } from "~/ui/game-menu/GameMenuProvider";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import type { ItemDetailControl } from "~/item-detail-frame/ItemDetailControl";
import { ItemDetailHigherOwnerGuard } from "~/item-detail-frame/ItemDetailHigherOwnerGuard";
import { ItemDetailProvider } from "~/item-detail-frame/ItemDetailProvider";
import { useItemDetailControl } from "~/item-detail-frame/useItemDetailControl";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

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
	}) =>
		itemId === "runtime:missing"
			? {
					kind: "unavailable",
				}
			: {
					itemId,
					kind: "available",
					tab: requestedTab ?? "lines",
					tabs: [
						"lines",
						"info",
					],
				},
}));

const roots: Array<ReturnType<typeof createRoot>> = [];
const providerGame = {
	config: {
		items: {},
	},
	getSnapshot: () => ({}),
	id: "game:item-detail-provider",
	readOrThrow: (request: {
		readonly target?: {
			readonly kind?: string;
		};
	}) =>
		request.target?.kind === "definition"
			? {
					kind: "unavailable",
				}
			: request,
} as unknown as GameEngine;

export const openItemDetail = (
	control: ItemDetailControl,
	props: Parameters<ItemDetailControl["openItemDetailFx"]>[0],
) => Effect.runSync(control.openItemDetailFx(props));

export const completeEnter = (control: ItemDetailControl, generation: number) =>
	Effect.runSync(control.completeEnterFx(generation));

export const completeExit = (control: ItemDetailControl, generation: number) =>
	Effect.runSync(control.completeExitFx(generation));

export const close = (
	control: ItemDetailControl,
	props?: Parameters<ItemDetailControl["closeFx"]>[0],
) => Effect.runPromise(control.closeFx(props));

export const runPendingAction = (
	control: ItemDetailControl,
	props: Parameters<ItemDetailControl["runPendingAction"]>[0],
) => control.runPendingAction(props);

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const Probe = ({ onControl }: { readonly onControl: (control: ItemDetailControl) => void }) => {
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

const MenuProbe = ({ onControl }: { readonly onControl: (control: GameMenuControl) => void }) => {
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

export const renderProvider = async () => {
	let control: ItemDetailControl | undefined;
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const render = (game: GameEngine = providerGame) =>
		root.render(
			createElement(
				ItemDetailProvider,
				{
					game,
				},
				createElement(Probe, {
					onControl: (next) => {
						control = next;
					},
				}),
			),
		);
	await act(async () => render());
	return {
		readControl: () => {
			if (control === undefined) throw new Error("Missing Item Detail control.");
			return control;
		},
		render,
	};
};

export const renderGuardedProvider = async () => {
	let itemDetail: ItemDetailControl | undefined;
	let gameMenu: GameMenuControl | undefined;
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				GameMenuProvider,
				null,
				createElement(
					ItemDetailProvider,
					{
						game: providerGame,
					},
					createElement(ItemDetailHigherOwnerGuard),
					createElement(Probe, {
						onControl: (next) => {
							itemDetail = next;
						},
					}),
					createElement(MenuProbe, {
						onControl: (next) => {
							gameMenu = next;
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
