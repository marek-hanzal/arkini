// @vitest-environment jsdom

import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, vi } from "vitest";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import { GameAudioContext } from "~/game-audio/context/GameAudioContext";
import type { ItemDetailControl } from "~/item-detail-frame/type/ItemDetailControl";
import { ItemDetailProvider } from "~/item-detail-frame/ui/ItemDetailProvider";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("~/item-detail-read/fn/resolveItemDetailTargetFn", () => ({
	resolveItemDetailTargetFn: ({ itemId }: { readonly itemId: string }) =>
		itemId === "runtime:missing"
			? {
					kind: "unavailable",
				}
			: {
					itemId,
					kind: "available",
				},
}));

const roots: Array<ReturnType<typeof createRoot>> = [];
const providerGame = {
	committedTransitionAtom: Atom.make({
		runtime: {
			items: [],
		},
	}),
	config: {
		items: {},
	},
	getSnapshotFn: () => ({
		currentSpace: 0,
	}),
	subscribeTransitionsFn: () => () => {},
	id: "game:item-detail-provider",
	readOrThrowFn: <Value>(request: Value) => request,
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

export const renderProvider = async (initialGame: Partial<GameEngine> = providerGame) => {
	let control: ItemDetailControl | undefined;
	const playSfxEventFn = vi.fn();
	const requestDetailMusicFn = vi.fn();
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const render = (game: Partial<GameEngine> = providerGame) =>
		root.render(
			createElement(
				GameAudioContext.Provider,
				{
					value: {
						playSfxEventFn,
						requestDetailMusicFn,
					},
				},
				createElement(
					ItemDetailProvider,
					{
						game: {
							...providerGame,
							...game,
						},
					},
					createElement(Probe, {
						onControl: (next) => {
							control = next;
						},
					}),
				),
			),
		);
	await act(async () => render(initialGame));
	return {
		readControl: () => {
			if (control === undefined) throw new Error("Missing Item Detail control.");
			return control;
		},
		playSfxEventFn,
		render,
	};
};
