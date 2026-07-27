import { Effect } from "effect";
import { Texture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { createPixiTileActorFx } from "~/ui/pixi/actor/createPixiTileActorFx";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";
import { updatePixiTileActorFx } from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";

vi.mock("~/ui/pixi/actor/loadPixiTileActorVisualTexturesFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		loadPixiTileActorVisualTexturesFx: () => EffectModule.void,
	};
});

vi.mock("~/ui/pixi/text/fitPixiSingleLineTextFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		fitPixiSingleLineTextFx: ({ text }: { readonly text: string }) =>
			EffectModule.succeed(text),
	};
});

vi.mock("~/ui/pixi/actor/updatePixiTileActorVisualFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		updatePixiTileActorVisualFx: () => EffectModule.void,
	};
});

const item = {
	id: "runtime:producer",
	itemId: "producer:lumberjack",
	itemType: "producer",
	location: {
		scope: "board",
		space: 0,
		position: {
			x: 1,
			y: 1,
		},
	},
	primaryAction: {
		kind: "none",
	},
	quantity: 1,
	revision: "revision:producer",
	running: true,
	runningGlow: true,
	sourceUrl: "resource:producer",
	title: "Lumberjack",
} satisfies TileActorItem;

const palette = {
	accent: 0xf05bb8,
	danger: 0,
	foreground: 0,
	gridA: 0,
	gridB: 0,
	line: 0,
	overlay: 0x20152a,
	overlayForeground: 0,
	success: 0x57d7b2,
	surface: 0,
	toolbarA: 0,
	toolbarB: 0,
};

describe("Pixi tile actor running glow layer", () => {
	it("retains the shared procedural texture strictly below all tile content", () => {
		const runningGlowTexture = new Texture();
		const actor = Effect.runSync(
			createPixiTileActorFx({
				frames: {
					closeFx: Effect.void,
					invalidateFx: Effect.void,
					reportCriticalFailure: vi.fn(),
				},
				item,
				palette,
				runningGlowTexture,
				textures: {} as never,
			}),
		);

		expect(actor.container.children).toEqual([
			actor.offsetLayer,
		]);
		expect(actor.offsetLayer.children).toEqual([
			actor.runningGlow,
			actor.crowdLayer,
			actor.progressBar,
		]);
		expect(actor.crowdLayer.children).toEqual([
			actor.visualLayer,
		]);
		expect(actor.visualLayer.children).toEqual([
			actor.currentVisual.container,
		]);
		expect(actor.runningGlow.texture).toBe(runningGlowTexture);
		expect(actor.runningGlow.anchor).toMatchObject({
			x: 0.5,
			y: 0.5,
		});
		expect(actor.runningGlow.visible).toBe(false);

		Effect.runSync(destroyPixiTileActorFx(actor));
		runningGlowTexture.destroy();
	});

	it("draws and clears the shared tile progress overlay from projected progress", () => {
		const frames = {
			closeFx: Effect.void,
			invalidateFx: Effect.void,
			reportCriticalFailure: vi.fn(),
		};
		const actor = Effect.runSync(
			createPixiTileActorFx({
				frames,
				item,
				palette,
				textures: {} as never,
			}),
		);
		const animator = {
			animateFx: () => Effect.void,
			cancelActorFx: () => Effect.void,
			cancelChannelFx: () => Effect.void,
			cancelFx: () => Effect.void,
			closeFx: Effect.void,
			setFx: () => Effect.void,
		} satisfies PixiActorAnimator;
		Effect.runSync(
			updatePixiTileActorFx({
				actor,
				animator,
				frames,
				item: {
					...item,
					progressRatio: 0.4,
				},
				palette,
				size: 80,
				textures: {} as never,
			}),
		);

		expect(actor.progressBar.visible).toBe(true);
		expect(actor.progressBar.getLocalBounds().width).toBeGreaterThan(0);

		Effect.runSync(
			updatePixiTileActorFx({
				actor,
				animator,
				frames,
				item,
				palette,
				size: 80,
				textures: {} as never,
			}),
		);

		expect(actor.progressBar.visible).toBe(false);
		Effect.runSync(destroyPixiTileActorFx(actor));
	});
});
