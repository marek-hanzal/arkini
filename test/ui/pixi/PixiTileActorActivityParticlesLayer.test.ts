import { Effect } from "effect";
import { ParticleContainer, Texture } from "pixi.js";
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
	activityEffect: true,
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
const darkPalette = {
	...palette,
	accent: 0xf05bb8,
	foreground: 0xfcf6ff,
	surface: 0x151020,
};
const lightPalette = {
	...palette,
	accent: 0xb9247d,
	foreground: 0x2a1532,
	surface: 0xfffaff,
};

describe("Pixi tile actor activity-particle layer", () => {
	it("retains one fixed ParticleContainer pool strictly below all tile content", () => {
		const mote = new Texture();
		const spark = new Texture();
		const actor = Effect.runSync(
			createPixiTileActorFx({
				frames: {
					closeFx: Effect.void,
					invalidateFx: Effect.void,
					reportCriticalFailure: vi.fn(),
				},
				item,
				palette,
				particleTextures: {
					mote,
					spark,
				},
				textures: {} as never,
			}),
		);

		expect(actor.container.children).toEqual([
			actor.offsetLayer,
		]);
		expect(actor.offsetLayer.children).toEqual([
			actor.activityParticles.container,
			actor.crowdLayer,
			actor.progressBar,
		]);
		expect(actor.crowdLayer.children).toEqual([
			actor.visualLayer,
		]);
		expect(actor.visualLayer.children).toEqual([
			actor.currentVisual.container,
		]);
		expect(actor.activityParticles.container).toBeInstanceOf(ParticleContainer);
		expect(actor.activityParticles.container.visible).toBe(false);
		expect(actor.activityParticles.particles).toHaveLength(12);
		expect(actor.activityParticles.particles.map(({ particle }) => particle.texture)).toContain(
			mote,
		);
		expect(actor.activityParticles.particles.map(({ particle }) => particle.texture)).toContain(
			spark,
		);

		Effect.runSync(destroyPixiTileActorFx(actor));
		mote.destroy();
		spark.destroy();
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
		const faceInset = 80 * 0.1;
		const faceSize = 80 * 0.8;
		const tallestParticleHalfHeight = Math.max(
			...actor.activityParticles.particles.map(
				({ particle }) => (particle.texture.height * particle.scaleY) / 2,
			),
		);
		expect(actor.activityParticles.topY - tallestParticleHalfHeight).toBeGreaterThanOrEqual(
			faceInset - faceSize * 0.5,
		);
		const renderedParticleWidths = actor.activityParticles.particles.map(
			({ particle }) => particle.texture.width * particle.scaleX,
		);
		expect(Math.min(...renderedParticleWidths)).toBeGreaterThanOrEqual(faceSize * 0.14);
		expect(actor.activityParticles.topHalfWidth).toBeGreaterThan(faceSize * 0.4);
		expect(actor.activityParticles.particles.every(({ particle }) => particle.scaleX > 0)).toBe(
			true,
		);

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

	it("switches retained particle compositing when the resolved theme changes", () => {
		const frames = {
			closeFx: Effect.void,
			invalidateFx: Effect.void,
			reportCriticalFailure: vi.fn(),
		};
		const actor = Effect.runSync(
			createPixiTileActorFx({
				frames,
				item,
				palette: darkPalette,
				textures: {} as never,
			}),
		);
		const particles = actor.activityParticles.particles;
		const animateFx = vi.fn(() => Effect.void);
		const animator = {
			animateFx,
			cancelActorFx: () => Effect.void,
			cancelChannelFx: () => Effect.void,
			cancelFx: () => Effect.void,
			closeFx: Effect.void,
			setFx: () => Effect.void,
		} satisfies PixiActorAnimator;

		expect(actor.activityParticles.container.blendMode).toBe("add");
		Effect.runSync(
			updatePixiTileActorFx({
				actor,
				animator,
				frames,
				item,
				palette: lightPalette,
				size: 80,
				textures: {} as never,
			}),
		);
		expect(actor.activityParticles.container.blendMode).toBe("normal");
		expect(actor.activityParticles.workingTint).toBe(lightPalette.accent);
		expect(actor.activityParticles.particles).toBe(particles);
		expect(animateFx).not.toHaveBeenCalled();

		Effect.runSync(
			updatePixiTileActorFx({
				actor,
				animator,
				frames,
				item,
				palette: darkPalette,
				size: 80,
				textures: {} as never,
			}),
		);
		expect(actor.activityParticles.container.blendMode).toBe("add");
		expect(actor.activityParticles.workingTint).toBe(darkPalette.accent);
		expect(actor.activityParticles.particles).toBe(particles);

		Effect.runSync(destroyPixiTileActorFx(actor));
	});
});
