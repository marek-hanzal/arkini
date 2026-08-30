import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { vi } from "vitest";

import type { GameEngine } from "~/renderer/game/GameEngine";
import type { GameTransition } from "~/renderer/game/session/GameSession";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { PixiInventorySurface } from "~/game-scene/ui/PixiInventorySurface";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const hoistedSurfaceState = vi.hoisted(() => ({
	activationGate: Promise.resolve(),
	activateSpace: vi.fn(),
	createProps: null as {
		readonly onActivate: (
			item: TileActorItem,
			openDetail: boolean,
			origin: HTMLElement,
		) => void | PromiseLike<void>;
	} | null,
	detail: vi.fn(),
	interactionCancel: vi.fn(),
	interactionRegister: vi.fn(),
	interactionUnregister: vi.fn(),
	projectSpaceActivation: vi.fn(),
	projection: Promise.resolve(),
	release: vi.fn(),
	spaceActivated: vi.fn(),
	spaceActivationSucceeds: true,
	spaceActivationTransition: null as GameTransition | null,
	textures: {} as object,
}));

export const surfaceState = hoistedSurfaceState;

export const spaceTransition = {
	events: [
		{
			type: "current-space:changed",
			previousSpace: 0,
			currentSpace: 1,
		},
	],
	previousRuntime: {
		currentSpace: 0,
	} as never,
	runtime: {
		currentSpace: 1,
	} as never,
	sequence: 1,
} as GameTransition;

const unrelatedTransition = {
	...spaceTransition,
	events: [],
	sequence: 2,
} as GameTransition;

const game = {
	config: {
		meta: {
			board: {
				height: 7,
				width: 11,
			},
			inventory: {
				height: 4,
				width: 5,
			},
			toolbarSize: 8,
		},
	},
	getTransitionSnapshot: () => unrelatedTransition,
	runFx: <Result, Error>(effect: Effect.Effect<Result, Error>) => effect,
} as GameEngine;

vi.mock("~/game-presentation/ui/useGameEngine", () => ({
	useGameEngine: () => game,
}));

vi.mock("~/application-runtime/service/RendererRuntime", () => ({
	RendererRuntime: {
		runPromise: Effect.runPromise,
		runSync: Effect.runSync,
	},
}));

vi.mock("~/item-interaction/fx/releaseInventoryItemFx", () => ({
	releaseInventoryItemFx: (props: unknown) =>
		Effect.sync(() => {
			surfaceState.release(props);
		}),
}));

vi.mock("~/space-action/fx/activateSpaceItemFx", () => ({
	activateSpaceItemWithTransitionFx: (props: unknown) =>
		Effect.sync(() => {
			surfaceState.activateSpace(props);
		}).pipe(
			Effect.andThen(Effect.promise(() => surfaceState.activationGate)),
			Effect.andThen(
				Effect.suspend(() =>
					surfaceState.spaceActivationSucceeds
						? Effect.succeed({
								result: 1,
								transition: surfaceState.spaceActivationTransition,
							})
						: Effect.fail("space-action-unavailable"),
				),
			),
		),
}));

vi.mock("~/item-detail-frame/ui/useItemDetailControl", () => ({
	useItemDetailControl: () => ({
		openItemDetailFx: (props: unknown) =>
			Effect.sync(() => {
				surfaceState.detail(props);
			}),
	}),
}));

vi.mock("~/game-scene/ui/PixiGameRuntime", () => ({
	usePixiGameRuntime: () => ({
		interaction: {
			registerFx: (cancel: () => void) =>
				Effect.sync(() => {
					surfaceState.interactionRegister(cancel);
					return surfaceState.interactionUnregister;
				}),
		},
		textures: surfaceState.textures,
	}),
}));

vi.mock("~/game-scene/fx/createInventoryRuntimeFx", () => ({
	createInventoryRuntimeFx: (props: NonNullable<typeof surfaceState.createProps>) =>
		Effect.sync(() => {
			surfaceState.createProps = props;
			return {
				canvas: document.createElement("canvas"),
				cancelInteractionFx: Effect.sync(surfaceState.interactionCancel),
				projectSpaceActivationFx: (transition: GameTransition) =>
					Effect.promise(() => {
						surfaceState.projectSpaceActivation(transition);
						return surfaceState.projection;
					}),
				closeFx: Effect.void,
			};
		}),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

export const resetPixiInventorySurfaceFixture = () => {
	surfaceState.activationGate = Promise.resolve();
	surfaceState.activateSpace.mockClear();
	surfaceState.createProps = null;
	surfaceState.detail.mockClear();
	surfaceState.interactionCancel.mockClear();
	surfaceState.interactionRegister.mockClear();
	surfaceState.interactionUnregister.mockClear();
	surfaceState.projectSpaceActivation.mockClear();
	surfaceState.projection = Promise.resolve();
	surfaceState.release.mockClear();
	surfaceState.spaceActivated.mockClear();
	surfaceState.spaceActivationSucceeds = true;
	surfaceState.spaceActivationTransition = spaceTransition;
	surfaceState.textures = {};
};

export const renderPixiInventorySurface = async () => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(PixiInventorySurface, {
				onSpaceActivated: surfaceState.spaceActivated,
			}),
		);
		await Promise.resolve();
	});
	const scene = surfaceState.createProps;
	if (scene === null) throw new Error("Inventory surface did not create its scene.");
	return {
		root,
		scene,
	};
};

export const replacePixiInventorySurfaceRuntime = async (root: ReturnType<typeof createRoot>) => {
	surfaceState.textures = {};
	await act(async () => {
		root.render(
			createElement(PixiInventorySurface, {
				onSpaceActivated: surfaceState.spaceActivated,
			}),
		);
		await Promise.resolve();
	});
};

export const unmountPixiInventorySurface = async (root: ReturnType<typeof createRoot>) => {
	const index = roots.indexOf(root);
	if (index >= 0) roots.splice(index, 1);
	await act(async () => root.unmount());
};

export const cleanupPixiInventorySurfaceFixture = async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	resetPixiInventorySurfaceFixture();
	document.body.replaceChildren();
};
