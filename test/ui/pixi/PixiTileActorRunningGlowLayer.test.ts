import { Effect } from "effect";
import { Texture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { createPixiTileActorFx } from "~/ui/pixi/actor/createPixiTileActorFx";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";

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

describe("Pixi tile actor running glow layer", () => {
	it("retains the shared procedural texture strictly below all tile content", () => {
		const runningGlowTexture = new Texture();
		const actor = Effect.runSync(
			createPixiTileActorFx({
				frames: {
					closeFx: Effect.void,
					invalidateFx: Effect.void,
				},
				item,
				palette: {
					accent: 0xf05bb8,
					danger: 0,
					foreground: 0,
					gridA: 0,
					gridB: 0,
					line: 0,
					overlay: 0,
					overlayForeground: 0,
					surface: 0,
					toolbarA: 0,
					toolbarB: 0,
				},
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
});
