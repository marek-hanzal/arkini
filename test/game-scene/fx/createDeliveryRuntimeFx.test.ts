import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import type { TileDelivery } from "~/game-scene/fx/readTileDeliveriesFx";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type {
	ActorAnimation,
	ActorAnimator,
	PresentationWrite,
} from "~/tile-rendering/service/ActorAnimator";
import { createDeliveryRuntimeFx } from "~/game-scene/fx/createDeliveryRuntimeFx";
import type { MainDragController } from "~/tile-interaction/fx/createMainDragControllerFx";
import type { MainSurface } from "~/game-scene/service/MainSurface";

vi.mock("~/tile-rendering/fx/updateTileActorFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		updateTileActorFx: ({
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

vi.mock("~/tile-motion/fx/flashMotionTargetFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		flashMotionTargetFx: () => EffectModule.void,
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
	itemUid: "water",

	title: "Water",
	artworkScale: 0.8,
	sourceUrl: "resource:water",
	revision: "revision:delivery",
	location: origin,
	running: false,
	activityEffect: false,
	primaryAction: {
		kind: "none" as const,
	},
};

describe("delivery runtime", () => {
	it.each([
		{
			travelCompleted: true,
			recovery: "none",
		},
		{
			travelCompleted: false,
			recovery: "none",
		},
		{
			travelCompleted: false,
			recovery: "delivery",
		},
		{
			travelCompleted: false,
			recovery: "grid",
		},
	])(
		"settles delivery exits (travel completed: $travelCompleted, recovery: $recovery)",
		({ travelCompleted, recovery }) => {
			const firstItem = {
				...item,
				id: "runtime:returning-water",
				revision: "revision:returning-water",
			};
			const secondItem = {
				...item,
				id: "runtime:returning-stone",
				itemUid: "stone",
				revision: "revision:returning-stone",
				sourceUrl: "resource:stone",
				title: "Stone",
			};
			const createActor = (deliveryItem: typeof firstItem) => {
				const container = new Container();
				container.position.set(0, 0);
				return {
					container,
					instanceId: `actor:${deliveryItem.id}`,
					item: deliveryItem,
					lifecycleDurationMs: 0,
					lifecycleAnimateScale: true,
					lifecycleTransitionStarted: false,
					lifecycleIntentGeneration: 0,
					lifecycleNotBeforeMs: 0,
					lifecycleTargetAlpha: 1,
					onPointerDown: null,
					size: 80,
				} as unknown as PixiTileActor;
			};
			const firstActor = createActor(firstItem);
			const secondActor = createActor(secondItem);
			const actors = new Map([
				[
					firstItem.id,
					firstActor,
				],
				[
					secondItem.id,
					secondActor,
				],
			]);
			const animations: ActorAnimation[] = [];
			const canonicalItems = new Map<string, typeof item>();
			const activeAnimations = new Map<string, ActorAnimation>();
			const destroyed: string[] = [];
			const animator = {
				animateFx: (animation: ActorAnimation) =>
					Effect.sync(() => {
						const key = `${animation.actor.item.id}:${animation.channel}`;
						activeAnimations.get(key)?.onCancelFn?.();
						activeAnimations.set(key, animation);
						animations.push(animation);
					}),
				cancelActorFx: () => Effect.void,
				cancelChannelFx: () => Effect.void,
				cancelFx: () => Effect.void,
				closeFx: Effect.void,
				isChannelActiveFx: () => Effect.succeed(false),
				setFx: () => Effect.void,
			} satisfies ActorAnimator;
			const runtime = Effect.runSync(
				createDeliveryRuntimeFx({
					actorStore: {
						actors,
						canonicalItems,
						destroyExitingActorFx: (actor: PixiTileActor) =>
							Effect.sync(() => {
								destroyed.push(actor.item.id);
								actor.container.destroy();
							}),
						releaseActorFx: (actorId: string) =>
							Effect.sync(() => {
								const actor = actors.get(actorId) ?? null;
								actors.delete(actorId);
								return actor;
							}),
					} as unknown as MainActorStore,
					animator,
					application: {
						frames: {
							invalidateFx: Effect.void,
						},
					} as never,
					drag: {
						attachActorFx: () => Effect.void,
						detachActorFx: () => Effect.void,
					} as unknown as MainDragController,
					particleTextures: {} as never,
					readPaletteFn: () => ({}) as never,
					surface: {
						readLocationPoseFx: (location: typeof origin) =>
							Effect.succeed({
								layer: new Container(),
								size: 80,
								x: location.position.x * 100,
								y: 0,
							}),
						transientActorLayer: new Container(),
					} as unknown as MainSurface,
					textures: {} as never,
				}),
			);
			const deliveries = [
				{
					from: target,
					generation: 1,
					remainingDurationMs: 500,
					item: firstItem,
					phase: travelCompleted ? "returning" : "outbound",
					to: origin,
				},
				{
					from: target,
					generation: 1,
					remainingDurationMs: 500,
					item: secondItem,
					phase: travelCompleted ? "returning" : "outbound",
					to: origin,
				},
			] satisfies TileDelivery[];

			Effect.runSync(runtime.syncFx(deliveries));
			const travels = animations.filter((animation) => animation.channel === "pose");
			expect(travels).toHaveLength(2);
			if (travelCompleted) {
				for (const travel of travels) {
					travel.onCompleteFn?.();
				}
			}

			Effect.runSync(runtime.syncFx([]));
			const fades = animations.filter(
				(animation) => animation.channel === "lifecycle-opacity" && animation.toAlpha === 0,
			);
			expect(fades).toHaveLength(2);
			expect(destroyed).toEqual([]);
			expect(actors.size).toBe(2);
			Effect.runSync(runtime.syncFx([]));
			expect(destroyed).toEqual([]);
			expect(
				animations.filter((animation) => animation.channel === "lifecycle-opacity"),
			).toHaveLength(2);

			if (recovery !== "none") {
				if (recovery === "grid") {
					canonicalItems.set(firstItem.id, firstItem);
					canonicalItems.set(secondItem.id, secondItem);
				}
				Effect.runSync(runtime.syncFx(recovery === "delivery" ? deliveries : []));
				expect(destroyed).toEqual([]);
				expect(firstActor.lifecycleTargetAlpha).toBe(1);
				expect(secondActor.lifecycleTargetAlpha).toBe(1);
				expect(
					animations.filter(
						(animation) =>
							animation.channel === "lifecycle-scale" && animation.toScale === 1,
					),
				).toHaveLength(2);
				// Late completions from superseded exits cannot release the revived actors.
				for (const fade of fades) fade.onCompleteFn?.();
				expect(actors.size).toBe(2);
				expect(destroyed).toEqual([]);
				expect(Effect.runSync(runtime.readSnapshotFx).retainedActorIds).toEqual(
					recovery === "delivery"
						? new Set([
								firstItem.id,
								secondItem.id,
							])
						: new Set(),
				);
				if (recovery === "delivery") {
					expect(
						animations.filter((animation) => animation.channel === "pose"),
					).toHaveLength(4);
				}
				return;
			}

			for (const fade of fades) {
				fade.onCompleteFn?.();
			}
			expect(destroyed).toEqual([
				firstItem.id,
				secondItem.id,
			]);
			expect(actors.size).toBe(0);
			expect(Effect.runSync(runtime.readSnapshotFx).retainedActorIds).toEqual(new Set());
		},
	);

	it("adopts one actor through missing geometry, return and canonical settlement", () => {
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
		const animations: ActorAnimation[] = [];
		let geometryAvailable = true;
		let geometryOffset = 0;
		let geometrySize = 80;
		const cancelChannelFx = vi.fn(() => Effect.void);
		const animator = {
			animateFx: (animation: ActorAnimation) =>
				Effect.sync(() => {
					animations.push(animation);
				}),
			cancelActorFx: () => Effect.void,
			cancelChannelFx,
			cancelFx: () => Effect.void,
			closeFx: Effect.void,
			isChannelActiveFx: () => Effect.succeed(false),
			setFx: (write: PresentationWrite) =>
				Effect.sync(() => {
					if (write.channel === "pose") {
						write.actor.container.position.set(write.x, write.y);
					}
				}),
		} satisfies ActorAnimator;
		const detachActorFx = vi.fn(() => Effect.void);
		const attachActorFx = vi.fn(() => Effect.void);
		const runtime = Effect.runSync(
			createDeliveryRuntimeFx({
				actorStore: {
					actors,
					canonicalItems,
				} as unknown as MainActorStore,
				animator,
				application: {
					frames: {
						invalidateFx: Effect.void,
					},
				} as never,
				drag: {
					attachActorFx,
					detachActorFx,
				} as unknown as MainDragController,
				particleTextures: {} as never,
				readPaletteFn: () => ({}) as never,
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
				} as unknown as MainSurface,
				textures: {} as never,
			}),
		);

		Effect.runSync(
			runtime.syncFx([
				{
					from: origin,
					generation: 0,
					remainingDurationMs: 500,
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
			durationMs: 400,
			ownerKey: "delivery:runtime:water:0",
		});
		if (animations[0]?.channel !== "pose") throw new Error("Expected outbound chase.");
		targetContainer.x = 340;
		animations[0].readPoseFn?.(0.5);
		expect(animations[0].readPoseFn?.(1)).toMatchObject({
			x: 340,
			y: 0,
		});

		geometryAvailable = false;
		Effect.runSync(
			runtime.syncFx([
				{
					from: origin,
					generation: 0,
					remainingDurationMs: 500,
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
					remainingDurationMs: 500,
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
		animations[1]?.onCompleteFn?.();

		container.position.set(90, 0);
		Effect.runSync(
			runtime.syncFx([
				{
					from: target,
					generation: 1,
					remainingDurationMs: 500,
					item: {
						...item,
						location: target,
						revision: "revision:returning",
					},
					phase: "returning",
					to: origin,
				},
			]),
		);
		expect(container.x).toBe(90);
		expect(animations).toHaveLength(3);
		geometryAvailable = false;
		Effect.runSync(
			runtime.syncFx([
				{
					from: target,
					generation: 1,
					remainingDurationMs: 500,
					item: {
						...item,
						location: target,
						revision: "revision:returning",
					},
					phase: "returning",
					to: origin,
				},
			]),
		);
		expect(container.visible).toBe(false);
		geometryAvailable = true;
		geometryOffset = 20;
		geometrySize = 100;
		Effect.runSync(
			runtime.syncFx([
				{
					from: target,
					generation: 1,
					remainingDurationMs: 500,
					item: {
						...item,
						location: target,
						revision: "revision:returning",
					},
					phase: "returning",
					to: origin,
				},
			]),
		);
		expect(container.visible).toBe(true);
		expect(actor.size).toBe(100);
		expect(animations[3]).toMatchObject({
			channel: "pose",
			curve: {
				bounce: 0.22,
				kind: "spring",
			},
			ownerKey: "delivery:runtime:water:1",
		});
		if (animations[3]?.channel !== "pose") throw new Error("Expected pose animation.");
		expect(animations[3].readPoseFn?.(1)).toMatchObject({
			x: 220,
			y: 0,
		});
		animations[3].onCompleteFn?.();
		animations[3].onCompleteFn?.();
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
