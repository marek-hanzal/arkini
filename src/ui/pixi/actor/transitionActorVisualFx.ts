import { Effect } from "effect";
import { Container } from "pixi.js";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { ActorVisual } from "~/ui/pixi/actor/ActorVisual";
import { whenVisualReadyFx } from "~/ui/pixi/actor/whenVisualReadyFx";
import { createActorVisualFx } from "~/ui/pixi/actor/createActorVisualFx";
import { destroyActorVisualFx } from "~/ui/pixi/actor/destroyActorVisualFx";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { runActorLifecycleFx } from "~/ui/pixi/animation/runActorLifecycleFx";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";
import type { TextureStore } from "~/ui/pixi/runtime/createTextureStoreFx";

export namespace transitionActorVisualFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
		readonly durationMs: number;
		readonly frames: DemandFrameLoop;
		readonly item: TileActorItem;
		readonly onDiscard?: () => void;
		readonly ownerKey: string;
		readonly palette: PixiScenePalette;
		readonly size: number;
		readonly textures: TextureStore;
	}
}

export const visualCrossfadeDurationMs = 950;

const readEffectiveAlpha = (visual: ActorVisual, visualLayer: Container) => {
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
	yield* runActorLifecycleFx({
		actor,
		animator,
		kind: "resume-enter",
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
