import { Effect } from "effect";
import { Container } from "pixi.js";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";
import { whenVisualReadyFx } from "~/ui/pixi/actor/whenVisualReadyFx";
import { createActorVisualFx } from "~/ui/pixi/actor/createActorVisualFx";
import { destroyActorVisualFx } from "~/ui/pixi/actor/destroyActorVisualFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { resumeActorEnterFx } from "~/ui/pixi/animation/resumeActorEnterFx";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createTextureStoreFx";

export namespace transitionActorVisualFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly durationMs: number;
		readonly frames: DemandFrameLoop;
		readonly item: TileActorItem;
		readonly onDiscard?: () => void;
		readonly ownerKey: string;
		readonly palette: PixiScenePalette;
		readonly size: number;
		readonly textures: PixiTextureStore;
	}
}

export const pixiTileActorVisualCrossfadeDurationMs = 950;

const readEffectiveAlpha = (visual: PixiTileActorVisual, visualLayer: Container) => {
	let alpha = visual.container.alpha;
	let parent = visual.container.parent;
	while (parent !== null && parent !== visualLayer) {
		alpha *= parent.alpha;
		parent = parent.parent;
	}
	return alpha;
};

/**
 * The sole lifecycle owner for a tile's double-buffered visual face.
 *
 * Every superseding revision flattens the currently presented composite from its live alpha,
 * prepares a complete incoming face in private, then crossfades both slots on one typed channel.
 */
export const transitionActorVisualFx = Effect.fn("transitionActorVisualFx")(function* ({
	actor,
	animator,
	durationMs,
	frames,
	item,
	onDiscard,
	ownerKey,
	palette,
	size,
	textures,
}: transitionActorVisualFx.Props) {
	const generation = ++actor.visualTransitionGeneration;
	yield* animator.cancelChannelFx(actor, "visual-mix");

	const oldTopLevelChildren = [
		...actor.visualLayer.children,
	];
	const oldVisuals = [
		...actor.visuals,
	];
	const outgoing = new Container({
		eventMode: "none",
		label: `TileActorOutgoingVisuals:${actor.instanceId}:${generation}`,
	});
	for (const visual of oldVisuals) {
		const alpha = readEffectiveAlpha(visual, actor.visualLayer);
		outgoing.addChild(visual.container);
		visual.container.alpha = alpha;
	}
	for (const child of oldTopLevelChildren) {
		if (oldVisuals.some(({ container }) => container === child)) continue;
		if (!child.destroyed) child.destroy();
	}
	actor.visualLayer.addChild(outgoing);

	const incoming = yield* createActorVisualFx({
		frames,
		item,
		palette,
		size,
		textures,
	});
	incoming.container.alpha = 0;
	actor.visuals.add(incoming);
	actor.pendingVisual = incoming;
	actor.visualLayer.addChild(incoming.container);
	yield* resumeActorEnterFx({
		actor,
		animator,
	});

	const ownsIncoming = () =>
		!actor.container.destroyed &&
		actor.visualTransitionGeneration === generation &&
		actor.pendingVisual === incoming;

	const discardIncoming = () => {
		if (!ownsIncoming()) return;
		actor.pendingVisual = null;
		actor.visuals.delete(incoming);
		RendererRuntime.runSync(destroyActorVisualFx(incoming));
		for (const visual of oldVisuals) {
			if (visual.container.destroyed) continue;
			if (visual === actor.currentVisual) {
				visual.container.alpha = 1;
				actor.visualLayer.addChild(visual.container);
				continue;
			}
			actor.visuals.delete(visual);
			RendererRuntime.runSync(destroyActorVisualFx(visual));
		}
		if (!outgoing.destroyed) outgoing.destroy();
		onDiscard?.();
		RendererRuntime.runSync(frames.invalidateFx);
	};

	yield* whenVisualReadyFx({
		visual: incoming,
		onCancel: discardIncoming,
		onReady: () => {
			if (!ownsIncoming()) return;
			RendererRuntime.runSync(
				animator.animateFx({
					actor,
					channel: "visual-mix",
					durationMs,
					incoming: incoming.container,
					outgoing,
					ownerKey,
					onComplete: () => {
						if (!ownsIncoming()) return;
						for (const visual of oldVisuals) {
							actor.visuals.delete(visual);
							RendererRuntime.runSync(destroyActorVisualFx(visual));
						}
						if (!outgoing.destroyed) outgoing.destroy();
						incoming.container.alpha = 1;
						actor.currentVisual = incoming;
						actor.pendingVisual = null;
						RendererRuntime.runSync(frames.invalidateFx);
					},
				}),
			);
		},
	});
});
