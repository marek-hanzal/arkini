import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
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

const sameVisualRevision = (left: TileActorItem, right: TileActorItem) =>
	left.revision === right.revision &&
	left.title === right.title &&
	left.badgeCount === right.badgeCount &&
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
	const runningGlowSize = faceSize * 1.6;
	actor.runningGlow.x = inset + faceSize / 2;
	actor.runningGlow.y = inset + faceSize / 2;
	actor.runningGlow.width = runningGlowSize;
	actor.runningGlow.height = runningGlowSize;
	actor.workingGlowTint = palette.accent;
	if (actor.feedbackGlowPhase === null) actor.runningGlow.tint = actor.workingGlowTint;

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
