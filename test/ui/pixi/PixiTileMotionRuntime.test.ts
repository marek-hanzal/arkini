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

const createItem = (id: string, location = firstBoardLocation) => ({
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
	});
});
