import { Effect } from "effect";
import { Rectangle } from "pixi.js";
import { match } from "ts-pattern";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import { readParticleLightSurfaceFn } from "~/tile-rendering/fn/readParticleLightSurfaceFn";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import { readActorCursorFn } from "~/tile-rendering/fn/readActorCursorFn";
import {
	visualCrossfadeDurationMs,
	transitionActorVisualFx,
} from "~/tile-rendering/fx/transitionActorVisualFx";
import { updateActorVisualFx } from "~/tile-rendering/fx/updateActorVisualFx";
import { updateActorProgressFx } from "~/tile-rendering/fx/updateActorProgressFx";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import type { DemandFrameLoop } from "~/tile-rendering/service/DemandFrameLoop";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";

export namespace updateTileActorFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
		readonly frames: DemandFrameLoop;
		readonly item: TileActorItem;
		readonly palette: PixiScenePalette;
		readonly preserveVisual?: boolean;
		readonly size: number;
		readonly textures: TextureStore;
	}
}

const tileToSlotRatio = 0.8;

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
export const updateTileActorFx = Effect.fn("updateTileActorFx")(function* ({
	actor,
	animator,
	frames,
	item,
	palette,
	preserveVisual = false,
	size,
	textures,
}: updateTileActorFx.Props) {
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
		actor.container.cursor = readActorCursorFn({
			phase: "idle",
			previewKind: null,
			running: item.running,
		});
	}
	actor.size = size;
	actor.lifecycleLayer.position.set(size / 2, size / 2);
	actor.lifecycleLayer.pivot.set(size / 2, size / 2);
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
	activityParticles.lightSurface = readParticleLightSurfaceFn(palette);
	activityParticles.container.blendMode = "normal";
	activityParticles.container.boundsArea = new Rectangle(0, 0, size, size);
	for (const [index, { particle }] of activityParticles.particles.entries()) {
		const particleSize = faceSize * (index % 4 === 0 ? 0.18 : index % 3 === 0 ? 0.15 : 0.11);
		particle.scaleX = particleSize / Math.max(1, particle.texture.width);
		particle.scaleY = particleSize / Math.max(1, particle.texture.height);
	}
	activityParticles.container.update();

	for (const visual of actor.visuals) {
		yield* updateActorVisualFx({
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
				transitionActorVisualFx({
					actor,
					animator,
					durationMs: visualCrossfadeDurationMs,
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
				updateActorVisualFx({
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
	yield* updateActorProgressFx({
		actor,
		frames,
		item,
		palette,
		size,
	});
});
