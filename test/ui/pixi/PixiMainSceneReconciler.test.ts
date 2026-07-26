import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimation, PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import type { PixiMainSceneDragController } from "~/ui/pixi/drag/PixiMainSceneDragController";
import { createPixiMainSceneDropPresentationFx } from "~/ui/pixi/drop/createPixiMainSceneDropPresentationFx";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import type { PixiTileMotionRuntime } from "~/ui/pixi/motion/PixiTileMotionRuntime";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import { createPixiMainSceneReconcilerFx } from "~/ui/pixi/scene/createPixiMainSceneReconcilerFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

const projectionState = vi.hoisted(() => ({
	inventory: [] as unknown[],
	main: [] as unknown[],
	replacements: [] as unknown[],
}));

vi.mock("~/bridge/tile/readTileActorsFx", () => ({
	readTileActorsFx: ({ surface }: { readonly surface: "inventory" | "main" }) => ({
		kind: "tile-actors",
		surface,
	}),
}));

vi.mock("~/bridge/tile/motion/readCommittedTileReplacementsFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		readCommittedTileReplacementsFx: () => EffectModule.succeed(projectionState.replacements),
	};
});

vi.mock("~/bridge/tile/motion/readTileMotionCuesFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		readTileMotionCuesFx: () => EffectModule.succeed([]),
	};
});

vi.mock("~/ui/pixi/actor/createPixiTileActorFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		createPixiTileActorFx: ({ item }: { readonly item: TileActorItem }) =>
			EffectModule.sync(() => {
				const container = {
					alpha: 1,
					destroyed: false,
					destroy: vi.fn(function (this: {
						destroyed: boolean;
					}) {
						this.destroyed = true;
					}),
					eventMode: "static",
					scale: {
						set: vi.fn(),
					},
					x: 0,
					y: 0,
				};
				return {
					container,
					crowdLayer: {
						alpha: item.running ? 0.82 : 1,
					},
					dragging: false,
					item,
					onPointerDown: null,
					size: 0,
					textureGeneration: 0,
				};
			}),
	};
});

vi.mock("~/ui/pixi/actor/updatePixiTileActorFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		updatePixiTileActorFx: ({
			actor,
			item,
			size,
		}: {
			readonly actor: PixiTileActor;
			readonly item: TileActorItem;
			readonly size: number;
		}) =>
			EffectModule.sync(() => {
				const runningChanged = actor.item.running !== item.running;
				actor.item = item;
				actor.size = size;
				if (runningChanged) actor.crowdLayer.alpha = item.running ? 0.82 : 1;
			}),
	};
});

const boardLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

const inventoryLocation = {
	scope: "inventory" as const,
	position: {
		x: 0,
		y: 0,
	},
};

const createItem = (id: string, location: TileActorItem["location"]): TileActorItem => ({
	compositeUrl: undefined,
	id,
	itemId: "water",
	location,
	primaryAction: {
		kind: "none",
	},
	quantity: 3,
	revision: `revision:${id}`,
	running: false,
	sourceUrl: "resource:water",
	title: "Water",
});

const createActor = (item: TileActorItem) => {
	const container = {
		alpha: 1,
		destroyed: false,
		destroy: vi.fn(function (this: {
			destroyed: boolean;
		}) {
			this.destroyed = true;
		}),
		scale: {
			set: vi.fn(),
		},
		x: 40,
		y: 60,
	};
	return {
		container,
		crowdLayer: {
			alpha: 1,
		},
		dragging: true,
		item,
		onPointerDown: null,
		size: 80,
		textureGeneration: 0,
	} as unknown as PixiTileActor;
};

beforeEach(() => {
	projectionState.main = [];
	projectionState.inventory = [];
	projectionState.replacements = [];
});

describe("Pixi main-scene reconciliation", () => {
	it("retains a pending source across an earlier transition, then destroys the exact pure Inventory source", () => {
		const source = createItem("runtime:water-source", boardLocation);
		const inventorySpawn = createItem("runtime:water-inventory-new-id", inventoryLocation);
		const actor = createActor(source);
		const actors = new Map([
			[
				source.id,
				actor,
			],
		]);
		const canonicalItems = new Map([
			[
				source.id,
				source,
			],
		]);
		const detachActor = vi.fn();
		const deleteActor = vi.fn();
		const animate = vi.fn<(animation: PixiActorAnimation) => void>();
		const cancel = vi.fn<(animationKey: string) => void>();
		const invalidate = vi.fn();
		const dropPresentation = Effect.runSync(createPixiMainSceneDropPresentationFx());
		const dropGeneration = Effect.runSync(
			dropPresentation.beginFx({
				sourceActorId: source.id,
				swapCandidate: null,
			}),
		);
		const actorStore = {
			actors,
			canonicalItems,
			closeFx: Effect.void,
			deleteActorFx: (actorId: string) =>
				Effect.sync(() => {
					deleteActor(actorId);
					const current = actors.get(actorId) ?? null;
					actors.delete(actorId);
					return current;
				}),
			readActorFx: (actorId: string) => Effect.succeed(actors.get(actorId) ?? null),
			readCanonicalItemFx: (actorId: string) =>
				Effect.succeed(canonicalItems.get(actorId) ?? null),
			replaceCanonicalItemsFx: (items: ReadonlyArray<TileActorItem>) =>
				Effect.sync(() => {
					canonicalItems.clear();
					for (const item of items) canonicalItems.set(item.id, item);
				}),
			setActorFx: (nextActor: PixiTileActor) =>
				Effect.sync(() => {
					actors.set(nextActor.item.id, nextActor);
				}),
		} satisfies PixiMainSceneActorStore;
		const drag = {
			attachActorFx: () => Effect.void,
			cancelInteractionFx: Effect.void,
			closeFx: Effect.void,
			detachActorFx: (target: PixiTileActor) =>
				Effect.sync(() => {
					detachActor(target);
				}),
			refreshPreviewFx: Effect.void,
			setInteractionBlockedFx: () => Effect.void,
		} satisfies PixiMainSceneDragController;
		const animator = {
			animateFx: (animation) =>
				Effect.sync(() => {
					animate(animation);
				}),
			cancelFx: (animationKey) =>
				Effect.sync(() => {
					cancel(animationKey);
				}),
			closeFx: Effect.void,
		} satisfies PixiActorAnimator;
		const game = {
			readOrThrow: (query: unknown) => {
				const projection = query as {
					readonly kind: "tile-actors";
					readonly surface: "inventory" | "main";
				};
				if (projection.kind !== "tile-actors") throw new Error("Unexpected game read.");
				return projectionState[projection.surface];
			},
		} as unknown as GameEngine;
		const motion = {
			closeFx: Effect.void,
			enqueueFx: () => Effect.void,
			readSnapshotFx: Effect.succeed({
				interactionClaimByActorId: new Map(),
				spawnCueByActorId: new Map(),
				unsettledQuantities: new Map(),
			}),
			startFx: Effect.void,
			syncQuantitiesFx: Effect.void,
		} satisfies PixiTileMotionRuntime;
		const reconciler = Effect.runSync(
			createPixiMainSceneReconcilerFx({
				actorStore,
				animator,
				application: {
					frames: {
						invalidateFx: Effect.sync(invalidate),
					},
				} as unknown as PixiApplicationOwner,
				drag,
				dropPresentation,
				game,
				magneticField: {
					closeFx: Effect.void,
					pruneFx: Effect.void,
					resetFx: Effect.void,
					updateFx: () => Effect.void,
				} satisfies PixiTileMagneticField,
				motion,
				readPalette: () => ({}) as never,
				surface: {
					readActorPoseFx: () => Effect.succeed(null),
				} as unknown as PixiMainSceneSurface,
				textures: {} as never,
			}),
		);
		projectionState.inventory = [
			inventorySpawn,
		];
		const committedAfterStore = {
			events: [],
			previousRuntime: null,
			runtime: {},
			sequence: 2,
		} as unknown as ReturnType<GameEngine["getTransitionSnapshot"]>;

		Effect.runSync(reconciler.reconcileFx(committedAfterStore));

		expect(actors.get(source.id)).toBe(actor);
		expect(detachActor).not.toHaveBeenCalled();
		expect(deleteActor).not.toHaveBeenCalled();
		expect(animate).not.toHaveBeenCalled();
		expect(actor.container.destroyed).toBe(false);

		const result = {
			kind: "store-inventory",
			source: {
				itemId: source.id,
				canonicalItemId: source.itemId,
				previousRevision: source.revision,
				previousLocation: source.location,
				previousQuantity: source.quantity,
				current: null,
			},
			inventory: {
				itemId: "runtime:backpack",
				revision: "revision:backpack",
				location: boardLocation,
			},
		} satisfies runTileDropAtom.Result;
		Effect.runSync(
			dropPresentation.completeFx({
				generation: dropGeneration,
				result,
			}),
		);
		Effect.runSync(reconciler.reconcileFx(committedAfterStore));

		expect(actors.has(source.id)).toBe(false);
		expect(detachActor).toHaveBeenCalledExactlyOnceWith(actor);
		expect(deleteActor).toHaveBeenCalledExactlyOnceWith(source.id);
		expect(cancel.mock.calls).toEqual([
			[
				source.id,
			],
			[
				`running:${source.id}`,
			],
			[
				`replacement-alpha:${source.id}`,
			],
		]);
		expect(animate).not.toHaveBeenCalled();
		expect(actor.container.destroyed).toBe(true);
		expect(invalidate).toHaveBeenCalledOnce();

		Effect.runSync(reconciler.reconcileFx(committedAfterStore));
		expect(actors.has(source.id)).toBe(false);
		expect(animate).not.toHaveBeenCalled();
	});

	it("crossfades both replacement actors while running opacity owns only its crowd channel", () => {
		const previous = {
			...createItem("runtime:producer", boardLocation),
			itemId: "producer:idle",
			running: false,
			sourceUrl: "resource:producer-idle",
			title: "Idle producer",
		} satisfies TileActorItem;
		const current = {
			...previous,
			itemId: "producer:running",
			revision: "revision:producer-running",
			running: true,
			sourceUrl: "resource:producer-running",
			title: "Running producer",
		} satisfies TileActorItem;
		const actor = createActor(previous);
		actor.dragging = false;
		const actors = new Map([
			[
				actor.item.id,
				actor,
			],
		]);
		const canonicalItems = new Map([
			[
				actor.item.id,
				actor.item,
			],
		]);
		const animations: PixiActorAnimation[] = [];
		const cancellations: string[] = [];
		const layer = {
			addChild: vi.fn(),
		};
		const actorStore = {
			actors,
			canonicalItems,
			closeFx: Effect.void,
			deleteActorFx: (actorId: string) =>
				Effect.sync(() => {
					const deleted = actors.get(actorId) ?? null;
					actors.delete(actorId);
					return deleted;
				}),
			readActorFx: (actorId: string) => Effect.succeed(actors.get(actorId) ?? null),
			readCanonicalItemFx: (actorId: string) =>
				Effect.succeed(canonicalItems.get(actorId) ?? null),
			replaceCanonicalItemsFx: (items: ReadonlyArray<TileActorItem>) =>
				Effect.sync(() => {
					canonicalItems.clear();
					for (const item of items) canonicalItems.set(item.id, item);
				}),
			setActorFx: (nextActor: PixiTileActor) =>
				Effect.sync(() => {
					actors.set(nextActor.item.id, nextActor);
				}),
		} satisfies PixiMainSceneActorStore;
		const drag = {
			attachActorFx: () => Effect.void,
			cancelInteractionFx: Effect.void,
			closeFx: Effect.void,
			detachActorFx: () => Effect.void,
			refreshPreviewFx: Effect.void,
			setInteractionBlockedFx: () => Effect.void,
		} satisfies PixiMainSceneDragController;
		const dropPresentation = Effect.runSync(createPixiMainSceneDropPresentationFx());
		const animator = {
			animateFx: (animation) =>
				Effect.sync(() => {
					animations.push(animation);
				}),
			cancelFx: (animationKey) =>
				Effect.sync(() => {
					cancellations.push(animationKey);
				}),
			closeFx: Effect.void,
		} satisfies PixiActorAnimator;
		const game = {
			readOrThrow: (query: unknown) => {
				const projection = query as {
					readonly kind: "tile-actors";
					readonly surface: "inventory" | "main";
				};
				if (projection.kind !== "tile-actors") throw new Error("Unexpected game read.");
				return projectionState[projection.surface];
			},
		} as unknown as GameEngine;
		const motion = {
			closeFx: Effect.void,
			enqueueFx: () => Effect.void,
			readSnapshotFx: Effect.succeed({
				interactionClaimByActorId: new Map(),
				spawnCueByActorId: new Map(),
				unsettledQuantities: new Map(),
			}),
			startFx: Effect.void,
			syncQuantitiesFx: Effect.void,
		} satisfies PixiTileMotionRuntime;
		const reconciler = Effect.runSync(
			createPixiMainSceneReconcilerFx({
				actorStore,
				animator,
				application: {
					frames: {
						invalidateFx: Effect.void,
					},
				} as unknown as PixiApplicationOwner,
				drag,
				dropPresentation,
				game,
				magneticField: {
					closeFx: Effect.void,
					pruneFx: Effect.void,
					resetFx: Effect.void,
					updateFx: () => Effect.void,
				} satisfies PixiTileMagneticField,
				motion,
				readPalette: () => ({}) as never,
				surface: {
					readActorPoseFx: () =>
						Effect.succeed({
							layer,
							size: 80,
							x: 40,
							y: 60,
						}),
					transientActorLayer: layer,
				} as unknown as PixiMainSceneSurface,
				textures: {} as never,
			}),
		);
		projectionState.main = [
			current,
		];
		projectionState.replacements = [
			{
				actorId: current.id,
				key: "2:0:replacement",
				previous: {
					compositeUrl: previous.compositeUrl,
					itemId: previous.itemId,
					sourceUrl: previous.sourceUrl,
					title: previous.title,
				},
				previousQuantity: previous.quantity,
			},
		];
		const transition = {
			events: [],
			previousRuntime: {},
			runtime: {},
			sequence: 2,
		} as unknown as ReturnType<GameEngine["getTransitionSnapshot"]>;

		Effect.runSync(reconciler.reconcileFx(transition));

		const running = animations.find(
			(animation) => animation.animationKey === `running:${current.id}`,
		);
		const incoming = animations.find(
			(animation) => animation.animationKey === `replacement-alpha:${current.id}`,
		);
		const outgoing = animations.find(
			(animation) => animation.animationKey === "replacement-out:2:0:replacement",
		);
		expect(running).toMatchObject({
			actor,
			durationMs: 180,
			toCrowdAlpha: 0.82,
		});
		expect(running?.toX).toBeUndefined();
		expect(running?.toY).toBeUndefined();
		expect(actor.crowdLayer.alpha).toBe(1);
		expect(actor.container.alpha).toBe(0);
		expect(incoming).toMatchObject({
			actor,
			durationMs: 280,
			toAlpha: 1,
		});
		expect(outgoing).toMatchObject({
			durationMs: 280,
			toAlpha: 0,
		});
		expect(outgoing?.actor).not.toBe(actor);
		expect(outgoing?.actor.container.alpha).toBe(1);

		projectionState.replacements = [
			{
				actorId: current.id,
				key: "3:0:replacement",
				previous: {
					compositeUrl: current.compositeUrl,
					itemId: current.itemId,
					sourceUrl: current.sourceUrl,
					title: current.title,
				},
				previousQuantity: current.quantity,
			},
		];
		Effect.runSync(
			reconciler.reconcileFx({
				...transition,
				sequence: 3,
			}),
		);
		expect(
			animations.filter(
				(animation) => animation.animationKey === `replacement-alpha:${current.id}`,
			),
		).toHaveLength(2);

		projectionState.main = [];
		projectionState.replacements = [];
		Effect.runSync(
			reconciler.reconcileFx({
				...transition,
				sequence: 4,
			}),
		);
		expect(cancellations).toContain(`replacement-alpha:${current.id}`);
	});
});
