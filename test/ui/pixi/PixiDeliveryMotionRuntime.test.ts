import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { TileDelivery } from "~/bridge/tile/readTileDeliveriesFx";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiActorAnimation,
	PixiActorAnimator,
	PixiActorPresentationWrite,
} from "~/ui/pixi/animation/PixiActorAnimator";
import { createPixiDeliveryMotionRuntimeFx } from "~/ui/pixi/delivery/createPixiDeliveryMotionRuntimeFx";
import type { PixiMainSceneDragController } from "~/ui/pixi/drag/PixiMainSceneDragController";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

vi.mock("~/ui/pixi/actor/updatePixiTileActorFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		updatePixiTileActorFx: ({
			actor,
			item,
			size,
		}: {
			readonly actor: PixiTileActor;
			readonly item: TileDelivery["item"];
			readonly size: number;
		}) =>
			EffectModule.sync(() => {
				actor.item = item;
				actor.size = size;
			}),
	};
});

vi.mock("~/ui/pixi/motion/flashPixiMotionTargetFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		flashPixiMotionTargetFx: () => EffectModule.void,
	};
});

const origin = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 2,
		y: 0,
	},
};
const target = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};
const item = {
	id: "runtime:water",
	itemId: "water",
	itemType: "simple" as const,
	title: "Water",
	sourceUrl: "resource:water",
	revision: "revision:delivery",
	quantity: 7,
	location: origin,
	running: false,
	activityEffect: false,
	primaryAction: {
		kind: "none" as const,
	},
};

describe("PixiDeliveryMotionRuntime", () => {
	it("adopts one actor, turns from its live pose on override, and settles each generation once", () => {
		const container = new Container();
		container.position.set(200, 0);
		const actor = {
			container,
			item,
			size: 80,
			onPointerDown: null,
		} as unknown as PixiTileActor;
		const targetContainer = new Container();
		targetContainer.position.set(0, 0);
		const targetActor = {
			container: targetContainer,
			item: {
				...item,
				id: "runtime:workshop",
				location: target,
			},
			size: 80,
			onPointerDown: null,
		} as unknown as PixiTileActor;
		const actors = new Map([
			[
				item.id,
				actor,
			],
			[
				targetActor.item.id,
				targetActor,
			],
		]);
		const canonicalItems = new Map([
			[
				item.id,
				item,
			],
		]);
		const animations: PixiActorAnimation[] = [];
		let geometryAvailable = true;
		let geometryOffset = 0;
		let geometrySize = 80;
		const cancelChannelFx = vi.fn(() => Effect.void);
		const animator = {
			animateFx: (animation: PixiActorAnimation) =>
				Effect.sync(() => {
					animations.push(animation);
				}),
			cancelActorFx: () => Effect.void,
			cancelChannelFx,
			cancelFx: () => Effect.void,
			closeFx: Effect.void,
			isChannelActiveFx: () => Effect.succeed(false),
			setFx: (write: PixiActorPresentationWrite) =>
				Effect.sync(() => {
					if (write.channel === "pose") {
						write.actor.container.position.set(write.x, write.y);
					}
				}),
		} satisfies PixiActorAnimator;
		const detachActorFx = vi.fn(() => Effect.void);
		const attachActorFx = vi.fn(() => Effect.void);
		const run = vi.fn(() => Promise.resolve(undefined));
		const updateMagnetFx = vi.fn(() => Effect.void);
		const releaseMagnetFx = vi.fn(() => Effect.void);
		const runtime = Effect.runSync(
			createPixiDeliveryMotionRuntimeFx({
				actorStore: {
					actors,
					canonicalItems,
				} as unknown as PixiMainSceneActorStore,
				animator,
				application: {
					frames: {
						invalidateFx: Effect.void,
					},
				} as never,
				drag: {
					attachActorFx,
					detachActorFx,
				} as unknown as PixiMainSceneDragController,
				game: {
					reportCriticalFailure: vi.fn(),
					run,
				} as unknown as GameEngine,
				magneticField: {
					closeFx: Effect.void,
					pruneFx: Effect.void,
					releaseFx: releaseMagnetFx,
					releaseSourcesFx: () => Effect.void,
					resetFx: Effect.void,
					updateFx: updateMagnetFx,
				},
				particleTextures: {} as never,
				readPalette: () => ({}) as never,
				surface: {
					readLocationPoseFx: (location: typeof origin) =>
						Effect.succeed(
							geometryAvailable
								? {
										layer: new Container(),
										size: geometrySize,
										x: location.position.x * 100 + geometryOffset,
										y: 0,
									}
								: null,
						),
					transientActorLayer: new Container(),
				} as unknown as PixiMainSceneSurface,
				textures: {} as never,
			}),
		);

		Effect.runSync(
			runtime.syncFx([
				{
					from: origin,
					generation: 0,
					item,
					phase: "outbound",
					targetActorId: targetActor.item.id,
					to: target,
				},
			]),
		);
		expect(detachActorFx).toHaveBeenCalledWith(actor);
		expect(animations).toHaveLength(1);
		expect(animations[0]).toMatchObject({
			channel: "pose",
			ownerKey: "delivery:runtime:water:0",
		});
		if (animations[0]?.channel !== "pose") throw new Error("Expected outbound chase.");
		targetContainer.x = 340;
		animations[0].readPose?.(0.5);
		expect(updateMagnetFx).toHaveBeenCalledWith(
			expect.objectContaining({
				attractedActorId: targetActor.item.id,
				sourceActorId: item.id,
				sourceKind: "motion",
			}),
		);
		expect(animations[0].readPose?.(1)).toMatchObject({
			x: 340,
			y: 0,
		});

		geometryAvailable = false;
		Effect.runSync(
			runtime.syncFx([
				{
					from: origin,
					generation: 0,
					item,
					phase: "outbound",
					targetActorId: targetActor.item.id,
					to: target,
				},
			]),
		);
		expect(cancelChannelFx).toHaveBeenCalledWith(actor, "pose");
		expect(container.visible).toBe(false);

		container.position.set(120, 0);
		geometryAvailable = true;
		Effect.runSync(
			runtime.syncFx([
				{
					from: origin,
					generation: 0,
					item,
					phase: "outbound",
					targetActorId: targetActor.item.id,
					to: target,
				},
			]),
		);
		expect(container.visible).toBe(true);
		expect(container.x).toBe(120);
		expect(animations).toHaveLength(2);
		animations[1]?.onComplete?.();
		expect(releaseMagnetFx).toHaveBeenCalledWith({
			sourceActorId: item.id,
			sourceKind: "motion",
		});
		expect(run).toHaveBeenCalledOnce();

		container.position.set(90, 0);
		Effect.runSync(
			runtime.syncFx([
				{
					from: target,
					generation: 1,
					item: {
						...item,
						location: target,
						quantity: 4,
						revision: "revision:returning",
					},
					phase: "returning",
					to: origin,
				},
			]),
		);
		expect(container.x).toBe(90);
		expect(animations).toHaveLength(3);
		expect(animations[2]).toMatchObject({
			channel: "lifecycle-opacity",
			durationMs: 275,
			ownerKey: "delivery:runtime:water:1:consume",
			toAlpha: 0,
		});
		expect(actor.item.quantity).toBe(7);
		geometryAvailable = false;
		Effect.runSync(
			runtime.syncFx([
				{
					from: target,
					generation: 1,
					item: {
						...item,
						location: target,
						quantity: 4,
						revision: "revision:returning",
					},
					phase: "returning",
					to: origin,
				},
			]),
		);
		expect(container.visible).toBe(false);
		animations[2]?.onComplete?.();
		expect(actor.item.quantity).toBe(4);
		expect(animations[3]).toMatchObject({
			channel: "lifecycle-opacity",
			durationMs: 375,
			ownerKey: "delivery:runtime:water:1:consume",
			toAlpha: 1,
		});
		animations[3]?.onComplete?.();
		expect(animations).toHaveLength(4);
		geometryAvailable = true;
		geometryOffset = 20;
		geometrySize = 100;
		Effect.runSync(
			runtime.syncFx([
				{
					from: target,
					generation: 1,
					item: {
						...item,
						location: target,
						quantity: 4,
						revision: "revision:returning",
					},
					phase: "returning",
					to: origin,
				},
			]),
		);
		expect(container.visible).toBe(true);
		expect(actor.size).toBe(100);
		expect(animations[4]).toMatchObject({
			channel: "pose",
			curve: {
				bounce: 0.22,
				kind: "spring",
			},
			ownerKey: "delivery:runtime:water:1",
		});
		if (animations[4]?.channel !== "pose") throw new Error("Expected pose animation.");
		expect(animations[4].readPose?.(1)).toMatchObject({
			x: 220,
			y: 0,
		});
		animations[4].onComplete?.();
		animations[4].onComplete?.();
		expect(run).toHaveBeenCalledTimes(2);
		expect(Effect.runSync(runtime.readSnapshotFx).retainedActorIds).toEqual(
			new Set([
				"runtime:water",
			]),
		);
		Effect.runSync(runtime.syncFx([]));
		expect(attachActorFx).toHaveBeenCalledWith(actor);
		expect(Effect.runSync(runtime.readSnapshotFx).retainedActorIds).toEqual(new Set());
	});
});
