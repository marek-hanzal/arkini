// @vitest-environment jsdom

import { Effect } from "effect";
import { Texture } from "pixi.js";
import { expect, it, vi } from "vitest";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { createTileActorFx } from "~/tile-rendering/fx/createTileActorFx";
import { destroyTileActorFx } from "~/tile-rendering/fx/destroyTileActorFx";
import { updateTileActorFx } from "~/tile-rendering/fx/updateTileActorFx";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";

const palette: PixiScenePalette = {
	accent: 0xff00ff,
	danger: 0,
	foreground: 0,
	gridA: 0,
	gridB: 0,
	line: 0,
	overlay: 0,
	overlayForeground: 0xffffff,
	success: 0,
	surface: 0,
};
const createItemFn = (artworkScale: number): TileActorItem => ({
	artworkScale,
	id: "runtime:tile",
	itemUid: "tile",

	location: {
		scope: "board",
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	primaryAction: {
		kind: "none",
	},
	revision: "revision:tile",
	running: false,

	sourceUrl: "resource:tile",
});
const createHarnessFn = (item: TileActorItem) => {
	const animateFx = vi.fn(() => Effect.void);
	const animator = {
		animateFx,
		cancelChannelFx: () => Effect.void,
	} as unknown as ActorAnimator;
	const frames = {
		addBeforeRenderListenerFx: () => Effect.succeed(() => {}),
		closeFx: Effect.void,
		invalidateFx: Effect.void,
		reportCriticalFailureFn: vi.fn(),
		scheduleAfterRenderFx: () => Effect.succeed(() => {}),
		scheduleFx: () => Effect.succeed(() => {}),
	};
	const textures = {
		acquireFn: () => ({
			releaseFn: () => {},
			textureFx: Effect.succeed(Texture.WHITE),
		}),
		closeFx: Effect.void,
	};
	const actor = Effect.runSync(
		createTileActorFx({
			frames,
			item,
			palette,
			textures,
		}),
	);
	const updateFn = (nextItem: TileActorItem, size: number) =>
		Effect.runSync(
			updateTileActorFx({
				animator,
				crossfadeArtworkFx: ({ onCompleteFn }) => Effect.sync(onCompleteFn),
				actor,
				frames,
				item: nextItem,
				palette,
				size,
				textures,
			}),
		);
	return {
		actor,
		animateFx,
		updateFn,
	};
};

it("keeps full-slot hit geometry and pose independent of artwork scale through resize", async () => {
	const item = createItemFn(0.625);
	const { actor, updateFn } = createHarnessFn(item);
	await vi.waitFor(() => expect(actor.currentVisual.textureState).toBe("ready"));
	for (const size of [
		512,
		256,
	]) {
		updateFn(item, size);
		expect(actor.currentVisual.primary.width).toBeLessThan(size);
		expect(actor.container.hitArea?.contains(0, 0)).toBe(true);
		expect(actor.container.hitArea?.contains(size, size)).toBe(true);
		expect(actor.container.hitArea?.contains(size + 1, size)).toBe(false);
		expect(actor.container.scale.x).toBe(1);
	}
	updateFn(
		{
			...item,
			artworkScale: 1,
		},
		256,
	);
	expect(actor.currentVisual.primary.width).toBe(256);
	expect(actor.container.scale.x).toBe(1);
	Effect.runSync(destroyTileActorFx(actor));
});

it("animates unit depletion on the retained artwork without touching its badge", async () => {
	const item = createItemFn(0.8);
	const { actor, animateFx, updateFn } = createHarnessFn(item);
	await vi.waitFor(() => expect(actor.currentVisual.textureState).toBe("ready"));
	updateFn(item, 256);
	const visual = actor.currentVisual;
	updateFn(
		{
			...item,
			colorFraction: 0.4,
		},
		256,
	);
	expect(actor.currentVisual).toBe(visual);
	expect(animateFx).toHaveBeenCalledWith({
		actor,
		channel: "artwork-color",
		durationMs: 300,
		toFraction: 0.4,
	});
	expect(visual.unitsFadeUniforms.uniforms.uColorFraction).toBe(1);
	expect(visual.badge.visible).toBe(false);
	updateFn(item, 256);
	expect(animateFx).toHaveBeenLastCalledWith({
		actor,
		channel: "artwork-color",
		durationMs: 300,
		toFraction: 1,
	});
	Effect.runSync(destroyTileActorFx(actor));
});
