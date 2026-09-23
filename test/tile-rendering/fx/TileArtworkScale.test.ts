// @vitest-environment jsdom

import { Effect } from "effect";
import { CanvasTextMetrics, Texture } from "pixi.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { createTileActorFx } from "~/tile-rendering/fx/createTileActorFx";
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
	badgeCount: 3,
	revision: "revision:tile",
	running: true,

	progressRatio: 0.5,
	sourceUrl: "resource:tile",
});
const createHarnessFn = (item: TileActorItem) => {
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
	it("keeps the centered authored face, badges and progress inside unchanged full-slot geometry", async () => {
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
						actor.currentVisual.badgeBackground,
					]) {
						const bounds = graphics.getLocalBounds();
						expect(bounds.minX).toBeGreaterThanOrEqual(0);
						expect(bounds.minY).toBeGreaterThanOrEqual(0);
						expect(bounds.maxX).toBeLessThanOrEqual(size);
						expect(bounds.maxY).toBeLessThanOrEqual(size);
					}
				}
			}
		}
	});

	it("updates scale without a runtime revision and keeps complete faces through layered revisions and resize", async () => {
		const item = createItemFn(0.8);
		const { actor, updateFn } = createHarnessFn(item);
		await vi.waitFor(() => expect(actor.currentVisual.textureState).toBe("ready"));
		updateFn(item, 512);
		const full = {
			...item,
			artworkScale: 1,
		};

		updateFn(full, 512);
		expect(actor.currentVisual.primary.width).toBe(512);

		const layered = {
			...full,
			artworkScale: 0.625,
			compositeUrl: "resource:overlay",
		};
		updateFn(layered, 512);
		await vi.waitFor(() => expect(actor.currentVisual.item).toBe(layered));
		updateFn(layered, 256);
		expect(actor.currentVisual.primary.width).toBe(120);
		expect(actor.currentVisual.primary.x).toBe(48);
		expect(actor.currentVisual.composite.x).toBe(88);

		const progress = {
			...full,
			artworkScale: 0.625,
			sourceUrl: "resource:progress",
		};
		updateFn(progress, 256);
		await vi.waitFor(() => expect(actor.currentVisual.item).toBe(progress));
		expect(actor.currentVisual.primary.width).toBe(160);
		expect(actor.currentVisual.primary.x).toBe(48);
		expect(actor.currentVisual.item.artworkScale).toBe(0.625);
		expect(actor.container.scale.x).toBe(1);
	});
});
