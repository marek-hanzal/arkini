import { Effect } from "effect";
import { Rectangle } from "pixi.js";
import { match } from "ts-pattern";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import {
	readPixiParticleBlendMode,
	readPixiParticleLightSurface,
} from "~/ui/pixi/appearance/readPixiParticleBlendMode";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { readPixiTileActorCursorFx } from "~/ui/pixi/actor/readPixiTileActorCursorFx";
import {
	pixiTileActorVisualCrossfadeDurationMs,
	transitionPixiTileActorVisualFx,
} from "~/ui/pixi/actor/transitionPixiTileActorVisualFx";
import { updatePixiTileActorVisualFx } from "~/ui/pixi/actor/updatePixiTileActorVisualFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";

export namespace updatePixiTileActorFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly frames: DemandFrameLoop;
		readonly item: TileActorItem;
		readonly palette: PixiScenePalette;
		readonly preserveVisual?: boolean;
		readonly size: number;
		readonly textures: PixiTextureStore;
	}
}

export namespace updatePixiTileActorProgressFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly frames: DemandFrameLoop;
		readonly item: TileActorItem;
		readonly palette: PixiScenePalette;
		readonly size: number;
	}
}

const tileToSlotRatio = 0.8;

const updateProgressBar = ({
	actor,
	palette,
	size,
}: {
	readonly actor: PixiTileActor;
	readonly palette: PixiScenePalette;
	readonly size: number;
}) => {
	const progressRatio = actor.item.progressRatio;
	actor.progressBar.clear();
	actor.progressBar.visible = progressRatio !== undefined;
	if (progressRatio === undefined) return;
	const inset = (size * (1 - tileToSlotRatio)) / 2;
	const faceSize = Math.max(1, size - inset * 2);
	const width = faceSize * 0.76;
	const height = Math.max(2, faceSize * 0.045);
	const x = inset + (faceSize - width) / 2;
	const y = inset + faceSize + Math.max(1, (inset - height) / 2);
	const radius = height / 2;
	actor.progressBar.roundRect(x, y, width, height, radius).fill({
		alpha: 0.62,
		color: palette.overlay,
	});
	if (progressRatio <= 0) return;
	actor.progressBar.roundRect(x, y, width * progressRatio, height, radius).fill({
		alpha: 0.96,
		color: palette.accent,
	});
};

/** Updates the 10 Hz job overlay without remeasuring or rebuilding either retained tile face. */
export const updatePixiTileActorProgressFx = Effect.fnUntraced(function* ({
	actor,
	frames,
	item,
	palette,
	size,
}: updatePixiTileActorProgressFx.Props) {
	actor.item = item;
	updateProgressBar({
		actor,
		palette,
		size,
	});
	yield* frames.invalidateFx;
});

const sameVisualRevision = (left: TileActorItem, right: TileActorItem) =>
	left.revision === right.revision &&
	left.title === right.title &&
	left.badgeCount === right.badgeCount &&
	left.badgeKind === right.badgeKind &&
	left.quantity === right.quantity &&
	left.sourceUrl === right.sourceUrl &&
	left.compositeUrl === right.compositeUrl;

/**
 * Reconciles actor metadata and layout without destroying the currently renderable face.
 *
 * Texture-bearing revisions are prepared in a private visual slot and published atomically. A
 * replacement transition may request `preserveVisual` and own the eventual double-buffer blend.
 */
export const updatePixiTileActorFx = Effect.fn("updatePixiTileActorFx")(function* ({
	actor,
	animator,
	frames,
	item,
	palette,
	preserveVisual = false,
	size,
	textures,
}: updatePixiTileActorFx.Props) {
	const pendingMatches =
		actor.pendingVisual !== null && sameVisualRevision(actor.pendingVisual.item, item);
	const texturesChanged =
		!pendingMatches &&
		(actor.pendingVisual !== null ||
			actor.currentVisual.item.sourceUrl !== item.sourceUrl ||
			actor.currentVisual.item.compositeUrl !== item.compositeUrl);
	const visualChanged =
		!pendingMatches &&
		(actor.pendingVisual !== null || !sameVisualRevision(actor.currentVisual.item, item));

	actor.item = item;
	if (!actor.dragging) {
		actor.container.cursor = yield* readPixiTileActorCursorFx({
			phase: "idle",
			previewKind: null,
			running: item.running,
		});
	}
	actor.size = size;
	actor.lifecycleLayer.position.set(size / 2, size / 2);
	actor.lifecycleLayer.pivot.set(size / 2, size / 2);
	updateProgressBar({
		actor,
		palette,
		size,
	});
	actor.container.hitArea = {
		contains: (x: number, y: number) => x >= 0 && x <= size && y >= 0 && y <= size,
	};

	const inset = (size * (1 - tileToSlotRatio)) / 2;
	const faceSize = Math.max(1, size - inset * 2);
	const activityParticles = actor.activityParticles;
	const largestParticleSize = faceSize * 0.18;
	const largestParticleHalfWidth = largestParticleSize / 2;
	const largestParticleHalfHeight = largestParticleSize / 2;
	activityParticles.centerX = inset + faceSize / 2;
	activityParticles.startY = Math.min(size - largestParticleHalfHeight, inset + faceSize * 0.92);
	activityParticles.topY = largestParticleHalfHeight;
	activityParticles.topHalfWidth = Math.min(
		faceSize * 0.46,
		Math.max(0, size / 2 - largestParticleHalfWidth) / 1.075,
	);
	activityParticles.workingTint = palette.accent;
	activityParticles.lightSurface = readPixiParticleLightSurface(palette);
	activityParticles.container.blendMode = readPixiParticleBlendMode();
	activityParticles.container.boundsArea = new Rectangle(0, 0, size, size);
	for (const [index, { particle }] of activityParticles.particles.entries()) {
		const particleSize = faceSize * (index % 4 === 0 ? 0.18 : index % 3 === 0 ? 0.15 : 0.11);
		particle.scaleX = particleSize / Math.max(1, particle.texture.width);
		particle.scaleY = particleSize / Math.max(1, particle.texture.height);
	}
	activityParticles.container.update();

	for (const visual of actor.visuals) {
		yield* updatePixiTileActorVisualFx({
			item: visual.item,
			palette,
			size,
			visual,
		});
	}

	yield* match({
		hasPendingVisual: actor.pendingVisual !== null,
		preserveVisual,
		texturesChanged,
		visualChanged,
	})
		.with(
			{
				preserveVisual: true,
			},
			() => Effect.void,
		)
		.with(
			{
				preserveVisual: false,
				texturesChanged: true,
				visualChanged: true,
			},
			() =>
				transitionPixiTileActorVisualFx({
					actor,
					animator,
					durationMs: pixiTileActorVisualCrossfadeDurationMs,
					frames,
					item,
					ownerKey: `visual-update:${actor.item.id}:${item.revision}`,
					palette,
					size,
					textures,
				}),
		)
		.with(
			{
				preserveVisual: false,
				texturesChanged: false,
				visualChanged: true,
			},
			() =>
				updatePixiTileActorVisualFx({
					item,
					palette,
					size,
					visual: actor.currentVisual,
				}),
		)
		.with(
			{
				hasPendingVisual: false,
				preserveVisual: false,
				visualChanged: false,
			},
			() =>
				Effect.sync(() => {
					actor.currentVisual.item = item;
				}),
		)
		.with(
			{
				hasPendingVisual: true,
				preserveVisual: false,
				visualChanged: false,
			},
			() => Effect.void,
		)
		.exhaustive();
	yield* frames.invalidateFx;
});
