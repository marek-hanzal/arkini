import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Effect, Exit } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { vi } from "vitest";

import { CheatAvailabilityAtom } from "~/ui/cheat-availability/CheatAvailabilityAtom";
import type { Game } from "~/renderer/game/Game";
import { CheatItemSpotlight } from "~/ui/cheat-spotlight/CheatItemSpotlight";
import { CheatItemSpawnProvider } from "~/ui/cheat-spotlight/CheatItemSpawnProvider";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
	complete: undefined as (() => void) | undefined,
	interrupted: vi.fn(),
	mode: "success" as "pending" | "success",
	run: vi.fn(),
	spawn: vi.fn(),
}));

export const spotlightState = state;

vi.mock("~/ui/cheats/useGameCheats", () => ({
	useGameCheats: () => ({
		enabled: true,
		everEnabled: true,
		instantGameplay: false,
	}),
}));
vi.mock("~/engine/cheat/write/spawnCheatItemFx", async () => {
	const { Effect } = await import("effect");
	return {
		spawnCheatItemFx: ({ itemId }: { readonly itemId: string }) => {
			state.spawn(itemId);
			return Effect.void;
		},
	};
});
vi.mock("~/ui/game-menu/useGameMenuControl", () => ({
	useGameMenuControl: () => ({
		phase: "closed",
	}),
}));
vi.mock("~/ui/item-detail/useItemDetailControl", () => ({
	useItemDetailControl: () => ({
		state: {
			phase: "closed",
		},
	}),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];
let registry: AtomRegistry.AtomRegistry;

export const createGame = (): Game =>
	({
		getResourceUrl: (resourceId: string) => `blob:${resourceId}`,
		read: () =>
			Exit.succeed([
				{
					itemId: "item:alpha",
					title: "Alpha",
					sourceResourceId: "alpha",
				},
				{
					itemId: "item:beta",
					title: "Beta",
					sourceResourceId: "beta",
				},
			]),
		runFx: ((effect: Effect.Effect<unknown, unknown>) => {
			state.run(effect);
			if (state.mode === "success") return effect;
			return Effect.callback<void>((resume) => {
				state.complete = () => {
					state.complete = undefined;
					state.mode = "success";
					resume(Effect.void);
				};
				return Effect.sync(state.interrupted);
			}).pipe(Effect.andThen(effect));
		}) as Game["runFx"],
	}) as unknown as Game;

export const beforeEachSpotlightTest = () => {
	registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	registry.set(CheatAvailabilityAtom, true);
	state.complete = undefined;
	state.interrupted.mockReset();
	state.mode = "success";
	state.run.mockReset();
	state.spawn.mockReset();
};

export const afterEachSpotlightTest = async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const current of registries.splice(0)) current.dispose();
	document.body.replaceChildren();
};

export const setCheatAvailability = (available: boolean) => {
	registry.set(CheatAvailabilityAtom, available);
};

export interface RenderSpotlightProps {
	readonly alwaysAvailable?: boolean;
	readonly game?: Game;
	readonly onBeforeOpen?: () => void;
}

export const renderSpotlight = async ({
	alwaysAvailable,
	game = createGame(),
	onBeforeOpen,
}: RenderSpotlightProps = {}) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const render = async (showSpotlight = true) => {
		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(
						CheatItemSpawnProvider,
						{
							game,
						},
						showSpotlight
							? createElement(CheatItemSpotlight, {
									alwaysAvailable,
									game,
									onBeforeOpen,
								})
							: null,
					),
				),
			);
		});
	};
	await render();
	return {
		container,
		game,
		render,
	};
};

export const toggleSpotlight = async () => {
	await act(async () => {
		document.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "p",
				code: "KeyP",
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			}),
		);
		await Promise.resolve();
	});
};

export const readSearchInput = (container: HTMLElement) => {
	const input = container.querySelector<HTMLInputElement>('input[type="search"]');
	if (input === null) throw new Error("Expected Spotlight search input.");
	return input;
};

export const changeSearchQuery = async (input: HTMLInputElement, query: string) => {
	const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (setter === undefined) throw new Error("Expected native input setter.");
	await act(async () => {
		setter.call(input, query);
		input.dispatchEvent(
			new Event("input", {
				bubbles: true,
			}),
		);
	});
};
