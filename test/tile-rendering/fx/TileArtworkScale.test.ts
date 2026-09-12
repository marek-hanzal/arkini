// @vitest-environment jsdom

import { Effect } from "effect";
import { CanvasTextMetrics, Texture } from "pixi.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { classifyActorUpdateFn } from "~/game-scene/fn/classifyActorUpdateFn";
import { createTileActorFx } from "~/tile-rendering/fx/createTileActorFx";
import { updateTileActorFx } from "~/tile-rendering/fx/updateTileActorFx";
import type { ActorAnimation, ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
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
	toolbarA: 0,
	toolbarB: 0,
};
const createItemFn = (artworkScale: number): TileActorItem => ({
	artworkScale,
	id: "runtime:tile",
	itemId: "tile",
	itemType: "common",
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
	quantity: 3,
	badgeCount: 3,
	revision: "revision:tile",
	running: true,
	activityEffect: true,
	progressRatio: 0.5,
	sourceUrl: "resource:tile",
	title: "Tile",
});
const createHarnessFn = (item: TileActorItem) => {
	const animations: ActorAnimation[] = [];
	const frames = {
		closeFx: Effect.void,
		invalidateFx: Effect.void,
		reportCriticalFailureFn: vi.fn(),
		scheduleAfterRenderFx: () => Effect.succeed(() => {}),
		scheduleFx: () => Effect.succeed(() => {}),
	};
	const textures = {
		closeFx: Effect.void,
		loadFx: () => Effect.succeed(Texture.WHITE),
	};
	const animator: ActorAnimator = {
		animateFx: (animation) =>
			Effect.sync(() => {
				if (animation.channel === "visual-mix") animations.push(animation);
			}),
		cancelActorFx: () => Effect.void,
		cancelChannelFx: () => Effect.void,
		cancelFx: () => Effect.void,
		closeFx: Effect.void,
		isChannelActiveFx: () => Effect.succeed(false),
		setFx: () => Effect.void,
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
				actor,
				animator,
				frames,
				item: nextItem,
				palette,
				size,
				textures,
			}),
		);
	return {
		actor,
		animations,
		updateFn,
	};
};

beforeEach(() => {
	vi.spyOn(CanvasTextMetrics, "measureText").mockImplementation((text, style) => {
		const width = (text.length * style.fontSize) / 2;
		return new CanvasTextMetrics(
			text,
			style,
			width,
			style.fontSize,
			[
				text,
			],
			[
				width,
			],
			style.fontSize,
			width,
			{
				ascent: style.fontSize,
				descent: 0,
				fontSize: style.fontSize,
			},
		);
	});
});

describe("authored tile artwork scale", () => {
	it("keeps the centered authored face, badges, progress and activity inside unchanged full-slot geometry", async () => {
		for (const scale of [
			0.8,
			1,
			0.625,
		]) {
			const item = createItemFn(scale);
			const { actor, updateFn } = createHarnessFn(item);
			await vi.waitFor(() => expect(actor.currentVisual.textureState).toBe("ready"));
			for (const location of [
				item.location,
				{
					scope: "inventory" as const,
					position: {
						x: 0,
						y: 0,
					},
				},
				{
					scope: "toolbar" as const,
					position: {
						x: 0,
						y: 0,
					},
				},
			]) {
				for (const size of [
					512,
					256,
				]) {
					updateFn(
						{
							...item,
							location,
						},
						size,
					);
					expect(actor.currentVisual.primary.width).toBeCloseTo(size * scale);
					expect(actor.currentVisual.primary.height).toBeCloseTo(size * scale);
					expect(actor.currentVisual.primary.x).toBeCloseTo((size * (1 - scale)) / 2);
					expect(actor.currentVisual.primary.y).toBeCloseTo((size * (1 - scale)) / 2);
					expect(actor.container.hitArea?.contains(0, 0)).toBe(true);
					expect(actor.container.hitArea?.contains(size, size)).toBe(true);
					expect(actor.container.hitArea?.contains(size + 1, size)).toBe(false);
					expect(actor.lifecycleLayer.pivot.x).toBe(size / 2);
					expect(actor.container.scale.x).toBe(1);
					for (const graphics of [
						actor.progressBar,
						actor.currentVisual.quantityBackground,
					]) {
						const bounds = graphics.getLocalBounds();
						expect(bounds.minX).toBeGreaterThanOrEqual(0);
						expect(bounds.minY).toBeGreaterThanOrEqual(0);
						expect(bounds.maxX).toBeLessThanOrEqual(size);
						expect(bounds.maxY).toBeLessThanOrEqual(size);
					}
					expect(actor.activityParticles.centerX).toBe(size / 2);
					expect(actor.activityParticles.particles[0].particle.scaleX).toBeCloseTo(
						size * scale * 0.18,
					);
				}
			}
		}
	});

	it("updates scale without a runtime revision and retains each face scale through layered/progress crossfades and resize", async () => {
		const item = createItemFn(0.8);
		const { actor, animations, updateFn } = createHarnessFn(item);
		await vi.waitFor(() => expect(actor.currentVisual.textureState).toBe("ready"));
		updateFn(item, 512);
		const full = {
			...item,
			artworkScale: 1,
		};
		expect(
			classifyActorUpdateFn({
				actor,
				displayItem: full,
				deliveryRetained: false,
				directLanding: false,
				motionClaimed: false,
				pose: {
					layer: actor.container,
					x: 0,
					y: 0,
					size: 512,
				},
				poseChannelActive: false,
				preserveVisual: false,
			}).item.kind,
		).toBe("visual");
		updateFn(full, 512);
		expect(actor.currentVisual.primary.width).toBe(512);
		expect(animations).toHaveLength(0);

		const layered = {
			...full,
			artworkScale: 0.625,
			compositeUrl: "resource:overlay",
		};
		updateFn(layered, 512);
		await vi.waitFor(() => expect(animations).toHaveLength(1));
		updateFn(layered, 256);
		expect(actor.currentVisual.primary.width).toBe(256);
		expect(actor.pendingVisual?.primary.width).toBe(120);
		expect(actor.pendingVisual?.primary.x).toBe(48);
		expect(actor.pendingVisual?.composite.x).toBe(88);
		animations[0].onCompleteFn?.();

		const progress = {
			...full,
			artworkScale: 0.625,
			sourceUrl: "resource:progress",
		};
		updateFn(progress, 256);
		await vi.waitFor(() => expect(animations).toHaveLength(2));
		expect(actor.currentVisual.primary.width).toBe(120);
		expect(actor.pendingVisual?.primary.width).toBe(160);
		expect(actor.pendingVisual?.primary.x).toBe(48);
		animations[1].onCompleteFn?.();
		expect(actor.currentVisual.item.artworkScale).toBe(0.625);
		expect(actor.container.scale.x).toBe(1);
	});
});
