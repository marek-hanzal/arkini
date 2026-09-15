import { Effect } from "effect";
import { Container, Rectangle, Sprite, type Texture } from "pixi.js";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { AnimationControl, AnimationDriver } from "~/tile-rendering/service/AnimationDriver";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { DragOriginGhosts } from "~/tile-interaction/type/DragOriginGhosts";
import type { MainInteractionSurface } from "~/tile-interaction/type/MainInteractionSurface";

interface Props {
	readonly animationDriver: AnimationDriver;
	readonly application: PixiApplicationOwner;
	readonly surface: MainInteractionSurface;
}

interface Ghost {
	readonly container: Container;
	readonly texture: Texture;
	entrance: AnimationControl | null;
	exit: AnimationControl | null;
}

const entranceDurationMs = 130;
const exitDurationMs = 150;
const restingAlpha = 0.24;

/**
 * Snapshots a dragged actor at its committed origin without creating another gameplay actor.
 *
 * Ghosts live in the origin actor layer, below its interactive children. They never enter actor
 * stores, hit testing, drop preview, or magnetic queries, and disappear only when presentation has
 * settled the real actor or retired it from the main scene.
 */
export const createDragOriginGhostsFx = Effect.fn("createDragOriginGhostsFx")(function* ({
	animationDriver,
	application,
	surface,
}: Props) {
	const ghosts = new Map<PixiTileActor, Ghost>();
	let closed = false;

	const destroyGhostFx = Effect.fn("DragOriginGhosts.destroyGhostFx")(function* (ghost: Ghost) {
		yield* ghost.entrance?.stopFx ?? Effect.void;
		yield* ghost.exit?.stopFx ?? Effect.void;
		ghost.container.destroy({
			children: true,
		});
		ghost.texture.destroy(true);
	});

	return {
		beginFx: Effect.fn("DragOriginGhosts.beginFx")((actor) =>
			Effect.gen(function* () {
				if (closed || actor.container.destroyed || actor.size <= 0) return;
				const pose = yield* surface.readActorPoseFx(actor.item);
				if (pose === null) return;
				const stale = ghosts.get(actor);
				if (stale !== undefined) {
					ghosts.delete(actor);
					yield* destroyGhostFx(stale);
				}

				const texture = application.app.renderer.generateTexture({
					antialias: true,
					frame: new Rectangle(0, 0, actor.size, actor.size),
					resolution: application.app.renderer.resolution,
					target: actor.container,
				});
				const sprite = new Sprite({
					anchor: 0.5,
					eventMode: "none",
					texture,
				});
				sprite.width = pose.size;
				sprite.height = pose.size;
				const container = new Container({
					alpha: 0,
					eventMode: "none",
					interactiveChildren: false,
					label: `DragOriginGhost:${actor.item.id}:${actor.instanceId}`,
					x: pose.x + pose.size / 2,
					y: pose.y + pose.size / 2,
				});
				container.scale.set(0.88);
				container.addChild(sprite);
				pose.layer.addChildAt(container, 0);
				const ghost: Ghost = {
					container,
					entrance: null,
					exit: null,
					texture,
				};
				ghosts.set(actor, ghost);
				ghost.entrance = yield* animationDriver.startTweenFx({
					durationMs: entranceDurationMs,
					from: 0,
					onUpdateFn: (progress) => {
						if (container.destroyed) return;
						container.alpha = restingAlpha * progress;
						container.scale.set(0.88 + 0.12 * progress);
					},
					to: 1,
				});
			}),
		),
		settleFx: Effect.fn("DragOriginGhosts.settleFx")((actor) =>
			Effect.gen(function* () {
				const ghost = ghosts.get(actor);
				if (ghost === undefined || ghost.exit !== null) return;
				yield* ghost.entrance?.stopFx ?? Effect.void;
				ghost.entrance = null;
				const startAlpha = ghost.container.alpha;
				const startScale = ghost.container.scale.x;
				ghost.exit = yield* animationDriver.startTweenFx({
					durationMs: exitDurationMs,
					from: 0,
					onCompleteFn: () => {
						if (ghosts.get(actor) !== ghost) return;
						ghosts.delete(actor);
						RendererRuntime.runSync(destroyGhostFx(ghost));
					},
					onUpdateFn: (progress) => {
						if (ghost.container.destroyed) return;
						ghost.container.alpha = startAlpha * (1 - progress);
						ghost.container.scale.set(startScale + 0.06 * progress);
					},
					to: 1,
				});
			}),
		),
		closeFx: Effect.gen(function* () {
			if (closed) return;
			closed = true;
			const active = Array.from(ghosts.values());
			ghosts.clear();
			yield* Effect.forEach(active, destroyGhostFx, {
				discard: true,
			});
		}),
	} satisfies DragOriginGhosts;
});
