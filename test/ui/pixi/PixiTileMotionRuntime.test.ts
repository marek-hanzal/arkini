// @vitest-environment jsdom

import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimation, PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { TileSceneHandoffStore } from "~/ui/pixi/handoff/createTileSceneHandoffStoreFx";
import { createPixiTileMotionRuntimeFx } from "~/ui/pixi/motion/createPixiTileMotionRuntimeFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

vi.mock("~/ui/pixi/actor/createPixiTileActorFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	const { Container: PixiContainer } = await import("pixi.js");
	return {
		createPixiTileActorFx: ({ item }: { readonly item: unknown }) =>
			EffectModule.succeed({
				container: new PixiContainer(),
				item,
				size: 80,
				textureGeneration: 0,
			}),
	};
});

vi.mock("~/ui/pixi/actor/updatePixiTileActorFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		updatePixiTileActorFx: () => EffectModule.void,
	};
});

const inventoryLocation = {
	scope: "inventory" as const,
	position: {
		x: 0,
		y: 0,
	},
};
const firstBoardLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 1,
		y: 0,
	},
};
const secondBoardLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 2,
		y: 0,
	},
};

const createItem = (
	id: string,
	location: TileActorItem["location"] = firstBoardLocation,
): TileActorItem => ({
	id,
	itemId: id,
	location,
	primaryAction: {
		kind: "none",
	},
	quantity: 1,
	revision: `revision:${id}`,
	running: false,
	sourceUrl: `resource:${id}`,
	title: id,
});

const createActor = (id: string) => {
	const container = new Container();
	container.alpha = 0;
	return {
		container,
		item: createItem(id),
		size: 80,
		textureGeneration: 0,
	} as unknown as PixiTileActor;
};

const createSwapHarness = ({
	includeSource = true,
	includeTarget = true,
}: {
	readonly includeSource?: boolean;
	readonly includeTarget?: boolean;
} = {}) => {
	const source = createActor("runtime:source");
	const target = createActor("runtime:target");
	source.container.x = 245;
	source.container.y = 47;
	target.container.x = 200;
	target.container.y = 40;
	source.item = createItem(source.item.id, secondBoardLocation);
	target.item = createItem(target.item.id, firstBoardLocation);
	const actors = new Map([
		...(includeSource
			? [
					[
						source.item.id,
						source,
					] as const,
				]
			: []),
		...(includeTarget
			? [
					[
						target.item.id,
						target,
					] as const,
				]
			: []),
	]);
	const canonicalItems = new Map([
		[
			source.item.id,
			source.item,
		],
		[
			target.item.id,
			target.item,
		],
	]);
	const animations: PixiActorAnimation[] = [];
	const canceledAnimationKeys: string[] = [];
	const transientActorLayer = new Container();
	const readPose = (location: TileActorItem["location"]) => ({
		layer: transientActorLayer,
		size: 80,
		x: location.position.x * 100,
		y: 40,
	});
	const runtime = Effect.runSync(
		createPixiTileMotionRuntimeFx({
			actorStore: {
				actors,
				canonicalItems,
				deleteActorFx: (actorId: string) =>
					Effect.sync(() => {
						const actor = actors.get(actorId) ?? null;
						actors.delete(actorId);
						return actor;
					}),
			} as unknown as PixiMainSceneActorStore,
			animator: {
				animateFx: (animation) =>
					Effect.sync(() => {
						animations.push(animation);
					}),
				cancelFx: (animationKey) =>
					Effect.sync(() => {
						canceledAnimationKeys.push(animationKey);
					}),
				closeFx: Effect.void,
			} satisfies PixiActorAnimator,
			application: {
				app: {
					canvas: {
						getBoundingClientRect: () => ({
							left: 0,
							top: 0,
						}),
					},
				},
				frames: {
					invalidateFx: Effect.void,
				},
			} as unknown as PixiApplicationOwner,
			handoffs: {
				takeFx: () => Effect.succeed(null),
			} as unknown as TileSceneHandoffStore,
			readPalette: () => ({}) as PixiScenePalette,
			surface: {
				readActorPoseFx: (item: TileActorItem) => Effect.succeed(readPose(item.location)),
				readLocationPoseFx: (location: TileActorItem["location"]) =>
					Effect.succeed(readPose(location)),
				transientActorLayer,
			} as unknown as PixiMainSceneSurface,
			textures: {} as never,
		}),
	);
	const cue = {
		actorId: target.item.id,
		counterpartActorId: source.item.id,
		eventIndex: 0,
		kind: "swap",
		originActorId: target.item.id,
		originLocation: secondBoardLocation,
		sequence: 9,
		staggerIndex: 0,
		targetLocation: firstBoardLocation,
	} satisfies TileMotionCue;
	return {
		actors,
		animations,
		canceledAnimationKeys,
		canonicalItems,
		cue,
		runtime,
		source,
		target,
	};
};

describe("Pixi tile motion runtime", () => {
	it("shares one Inventory handoff across a delivery batch and fades a spawn in", () => {
		const spawned = createActor("runtime:spawned");
		const stacked = createActor("runtime:stacked");
		const actors = new Map([
			[
				spawned.item.id,
				spawned,
			],
			[
				stacked.item.id,
				stacked,
			],
		]);
		const canonicalItems = new Map([
			[
				spawned.item.id,
				spawned.item,
			],
			[
				stacked.item.id,
				stacked.item,
			],
		]);
		const animations: PixiActorAnimation[] = [];
		const takeHandoff = vi.fn(() =>
			Effect.succeed({
				centerX: 150,
				centerY: 170,
				size: 80,
			}),
		);
		const transientActorLayer = new Container();
		const readLocationPose = (
			location: typeof inventoryLocation | typeof firstBoardLocation,
		) =>
			location.scope === "inventory"
				? null
				: {
						layer: transientActorLayer,
						size: 80,
						x: location.position.x * 100,
						y: 40,
					};
		const runtime = Effect.runSync(
			createPixiTileMotionRuntimeFx({
				actorStore: {
					actors,
					canonicalItems,
					deleteActorFx: (actorId: string) =>
						Effect.sync(() => {
							const actor = actors.get(actorId) ?? null;
							actors.delete(actorId);
							return actor;
						}),
				} as unknown as PixiMainSceneActorStore,
				animator: {
					animateFx: (animation) =>
						Effect.sync(() => {
							animations.push(animation);
						}),
					cancelFx: () => Effect.void,
					closeFx: Effect.void,
				} satisfies PixiActorAnimator,
				application: {
					app: {
						canvas: {
							getBoundingClientRect: () => ({
								left: 10,
								top: 20,
							}),
						},
					},
					frames: {
						invalidateFx: Effect.void,
					},
				} as unknown as PixiApplicationOwner,
				handoffs: {
					takeFx: takeHandoff,
				} as unknown as TileSceneHandoffStore,
				readPalette: () => ({}) as PixiScenePalette,
				surface: {
					readActorPoseFx: (item: TileActorItem) =>
						Effect.succeed(
							readLocationPose(
								item.location as
									| typeof inventoryLocation
									| typeof firstBoardLocation,
							),
						),
					readLocationPoseFx: (location: TileActorItem["location"]) =>
						Effect.succeed(
							readLocationPose(
								location as typeof inventoryLocation | typeof firstBoardLocation,
							),
						),
					transientActorLayer,
				} as unknown as PixiMainSceneSurface,
				textures: {} as never,
			}),
		);
		const cues = [
			{
				actorId: spawned.item.id,
				eventIndex: 0,
				kind: "spawn",
				originActorId: "runtime:inventory-origin",
				originLocation: inventoryLocation,
				sequence: 7,
				staggerIndex: 0,
				targetLocation: firstBoardLocation,
			},
			{
				canonicalItemId: stacked.item.itemId,
				eventIndex: 1,
				kind: "stack",
				originActorId: "runtime:inventory-origin",
				originLocation: inventoryLocation,
				quantity: 1,
				sequence: 7,
				staggerIndex: 1,
				targetActorId: stacked.item.id,
				targetLocation: secondBoardLocation,
			},
		] satisfies TileMotionCue[];

		Effect.runSync(runtime.enqueueFx(cues));
		Effect.runSync(runtime.startFx);

		expect(takeHandoff).toHaveBeenCalledOnce();
		expect(animations).toHaveLength(2);
		expect(animations[0]).toMatchObject({
			actor: spawned,
			toAlpha: 1,
			toX: 100,
			toY: 40,
		});
		expect(spawned.container.x).toBe(100);
		expect(spawned.container.y).toBe(110);
		expect(animations[1]?.actor.container.x).toBe(100);
		expect(animations[1]?.actor.container.y).toBe(110);

		const stackTransient = animations[1]?.actor;
		Effect.runSync(runtime.closeFx);
		expect(stackTransient?.container.destroyed).toBe(true);
		expect(spawned.container.destroyed).toBe(false);
	});

	it("animates both swap legs from their live poses and releases claims together", () => {
		const { animations, cue, runtime, source, target } = createSwapHarness();

		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);

		expect(animations).toHaveLength(2);
		expect(animations.find((animation) => animation.actor === target)).toMatchObject({
			toX: 100,
			toY: 40,
		});
		expect(animations.find((animation) => animation.actor === source)).toMatchObject({
			toX: 200,
			toY: 40,
		});
		expect(source.container.x).toBe(245);
		expect(source.container.y).toBe(47);
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(
			new Map([
				[
					target.item.id,
					"activation-only",
				],
				[
					source.item.id,
					"activation-only",
				],
			]),
		);

		animations.find((animation) => animation.actor === target)?.onComplete?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.size).toBe(2);
		animations.find((animation) => animation.actor === source)?.onComplete?.();

		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
		expect(target.container.x).toBe(100);
		expect(source.container.x).toBe(200);
	});

	it("animates and completes the available swap leg when its counterpart actor is missing", () => {
		const { animations, cue, runtime, target } = createSwapHarness({
			includeSource: false,
		});

		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);

		expect(animations).toHaveLength(1);
		expect(animations[0]?.actor).toBe(target);
		animations[0]?.onComplete?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
	});

	it("retargets each completed swap leg to its latest canonical pose", () => {
		const { animations, canonicalItems, cue, runtime, source, target } = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		canonicalItems.set(
			target.item.id,
			createItem(target.item.id, {
				...firstBoardLocation,
				position: {
					x: 4,
					y: 0,
				},
			}),
		);
		canonicalItems.set(
			source.item.id,
			createItem(source.item.id, {
				...secondBoardLocation,
				position: {
					x: 5,
					y: 0,
				},
			}),
		);

		for (const animation of animations) animation.onComplete?.();

		expect(target.container.x).toBe(400);
		expect(source.container.x).toBe(500);
	});

	it("deduplicates completed cues and ignores duplicate leg completion", () => {
		const { animations, cue, runtime } = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);

		animations[0]?.onComplete?.();
		animations[0]?.onComplete?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.size).toBe(2);
		animations[1]?.onComplete?.();
		animations[1]?.onComplete?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.size).toBe(0);

		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		expect(animations).toHaveLength(2);
	});

	it("keeps blocked interaction stronger than activation-only on overlapping cues", () => {
		const { cue, runtime, target } = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
				{
					actorId: target.item.id,
					eventIndex: 1,
					kind: "spawn",
					originActorId: target.item.id,
					originLocation: secondBoardLocation,
					sequence: cue.sequence,
					staggerIndex: 0,
					targetLocation: firstBoardLocation,
				},
			]),
		);

		expect(
			Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.get(target.item.id),
		).toBe("blocked");
	});

	it("clears claims on close and ignores late swap completion callbacks", () => {
		const { animations, canceledAnimationKeys, cue, runtime } = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);

		Effect.runSync(runtime.closeFx);
		for (const animation of animations) animation.onComplete?.();

		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
		expect(canceledAnimationKeys).toContain(`motion:9:0:${cue.actorId}`);
		expect(canceledAnimationKeys).toContain(`motion:9:0:${cue.counterpartActorId}`);
		expect(animations).toHaveLength(2);
	});
});
