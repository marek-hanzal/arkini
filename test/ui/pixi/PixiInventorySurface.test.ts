// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { GameTransition } from "~/bridge/game/GameSession";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { PixiInventorySurface } from "~/ui/pixi/PixiInventorySurface";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const surfaceState = vi.hoisted(() => ({
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

const spaceTransition = {
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

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => game,
}));

vi.mock("~/bridge/runtime/RendererRuntime", () => ({
	RendererRuntime: {
		runPromise: Effect.runPromise,
		runSync: Effect.runSync,
	},
}));

vi.mock("~/engine/runtime/write/releaseInventoryItemFx", () => ({
	releaseInventoryItemFx: (props: unknown) =>
		Effect.sync(() => {
			surfaceState.release(props);
		}),
}));

vi.mock("~/engine/space/write/activateSpaceItemWithTransitionFx", () => ({
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

vi.mock("~/ui/item-detail/useItemDetailControl", () => ({
	useItemDetailControl: () => ({
		openItemDetailFx: (props: unknown) =>
			Effect.sync(() => {
				surfaceState.detail(props);
			}),
	}),
}));

vi.mock("~/ui/pixi/usePixiGameRuntime", () => ({
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

vi.mock("~/ui/pixi/scene/createPixiInventorySceneRuntimeFx", () => ({
	createPixiInventorySceneRuntimeFx: (props: NonNullable<typeof surfaceState.createProps>) =>
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

const item = {
	id: "runtime:water",
	itemId: "water",
	itemType: "simple",
	location: {
		scope: "inventory",
		position: {
			x: 1,
			y: 0,
		},
	},
	primaryAction: {
		kind: "none",
	},
	quantity: 4,
	revision: "revision:water",
	running: false,
	activityEffect: false,
	sourceUrl: "resource:water",
	title: "Water",
} satisfies TileActorItem;

const roots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
	surfaceState.activationGate = Promise.resolve();
	surfaceState.spaceActivationTransition = spaceTransition;
	surfaceState.textures = {};
});

const renderSurface = async () => {
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
	const createProps = surfaceState.createProps;
	if (createProps === null) throw new Error("Inventory surface did not create its scene.");
	return createProps;
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	surfaceState.createProps = null;
	surfaceState.activateSpace.mockClear();
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
	document.body.replaceChildren();
});

describe("PixiInventorySurface", () => {
	it("hands an ordinary click to the exact Inventory release command", async () => {
		const props = await renderSurface();
		const canvas = document.createElement("canvas");

		await props.onActivate(item, false, canvas);

		expect(surfaceState.release).toHaveBeenCalledWith({
			itemId: item.id,
			location: item.location,
			revision: item.revision,
		});
		expect(surfaceState.detail).not.toHaveBeenCalled();
		expect(surfaceState.interactionRegister).toHaveBeenCalledOnce();
		const registeredCancel = surfaceState.interactionRegister.mock.calls[0]?.[0] as
			| (() => void)
			| undefined;
		if (registeredCancel === undefined) throw new Error("Interaction cancel is missing.");
		registeredCancel();
		expect(surfaceState.interactionCancel).toHaveBeenCalledOnce();
		const root = roots.pop();
		if (root === undefined) throw new Error("Inventory surface root is missing.");
		await act(async () => root.unmount());
		expect(surfaceState.interactionUnregister).toHaveBeenCalledOnce();
	});

	it("keeps right click as Item Detail without releasing the item", async () => {
		const props = await renderSurface();
		const canvas = document.createElement("canvas");

		await props.onActivate(item, true, canvas);

		expect(surfaceState.detail).toHaveBeenCalledWith({
			itemId: item.id,
			origin: canvas,
		});
		expect(surfaceState.release).not.toHaveBeenCalled();
	});

	it("returns to the Board only after Inventory Space activation commits", async () => {
		const props = await renderSurface();
		const space = {
			...item,
			itemType: "space",
			primaryAction: {
				currentSpace: 0,
				kind: "activate-space",
			},
		} satisfies TileActorItem;

		surfaceState.spaceActivationSucceeds = false;
		await props.onActivate(space, false, document.createElement("canvas"));

		expect(surfaceState.activateSpace).toHaveBeenCalledWith({
			currentSpace: 0,
			itemId: space.id,
			location: space.location,
			revision: space.revision,
		});
		expect(surfaceState.spaceActivated).not.toHaveBeenCalled();
		expect(surfaceState.projectSpaceActivation).not.toHaveBeenCalled();
		expect(surfaceState.release).not.toHaveBeenCalled();

		surfaceState.spaceActivationSucceeds = true;
		let releaseProjection: () => void = () => undefined;
		let acknowledgeProjectionStart: () => void = () => undefined;
		surfaceState.projection = new Promise<void>((resolve) => {
			releaseProjection = resolve;
		});
		const projectionStarted = new Promise<void>((resolve) => {
			acknowledgeProjectionStart = resolve;
		});
		surfaceState.projectSpaceActivation.mockImplementationOnce(acknowledgeProjectionStart);
		const activation = props.onActivate(space, false, document.createElement("canvas"));
		await projectionStarted;

		expect(surfaceState.projectSpaceActivation).toHaveBeenCalledWith(spaceTransition);
		expect(surfaceState.spaceActivated).not.toHaveBeenCalled();

		releaseProjection();
		await activation;
		expect(surfaceState.spaceActivated).toHaveBeenCalledOnce();
		expect(surfaceState.release).not.toHaveBeenCalled();
	});

	it("returns to the Board for an accepted no-op without replaying an older transition", async () => {
		const props = await renderSurface();
		const space = {
			...item,
			itemType: "space",
			primaryAction: {
				currentSpace: 0,
				kind: "activate-space",
			},
		} satisfies TileActorItem;
		surfaceState.spaceActivationTransition = null;

		await props.onActivate(space, false, document.createElement("canvas"));

		expect(surfaceState.projectSpaceActivation).not.toHaveBeenCalled();
		expect(surfaceState.spaceActivated).toHaveBeenCalledOnce();
	});

	it("does not project a deferred activation into a replacement Inventory runtime", async () => {
		const props = await renderSurface();
		const root = roots[roots.length - 1];
		if (root === undefined) throw new Error("Inventory surface root is missing.");
		const space = {
			...item,
			itemType: "space",
			primaryAction: {
				currentSpace: 0,
				kind: "activate-space",
			},
		} satisfies TileActorItem;
		let releaseActivation: () => void = () => undefined;
		surfaceState.activationGate = new Promise<void>((resolve) => {
			releaseActivation = resolve;
		});

		const activation = props.onActivate(space, false, document.createElement("canvas"));
		await vi.waitFor(() => expect(surfaceState.activateSpace).toHaveBeenCalledOnce());

		surfaceState.textures = {};
		await act(async () => {
			root.render(
				createElement(PixiInventorySurface, {
					onSpaceActivated: surfaceState.spaceActivated,
				}),
			);
			await Promise.resolve();
		});

		releaseActivation();
		await activation;

		expect(surfaceState.projectSpaceActivation).not.toHaveBeenCalled();
		expect(surfaceState.spaceActivated).not.toHaveBeenCalled();
	});
});
