import { Effect } from "effect";
import { Container, Sprite, type Renderer } from "pixi.js";

import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";

/** Leaves a short, non-interactive visual tail above content while ground resumes its real layer. */
export const settleActorLayerFx = Effect.fn("settleActorLayerFx")(function* ({
	actor,
	animator,
	layer,
	renderer,
}: {
	readonly actor: PixiTileActor;
	readonly animator: ActorAnimator;
	readonly layer: Container;
	readonly renderer: Renderer;
}) {
	if (actor.container.destroyed || actor.container.parent === layer) return;
	yield* animator.cancelChannelFx(actor, "layer-release");
	const previousLayer = actor.container.parent;
	if (
		actor.item.layer !== "ground" ||
		actor.item.location.scope !== "board" ||
		previousLayer === null
	) {
		layer.addChild(actor.container);
		return;
	}
	const bounds = actor.container.getLocalBounds().rectangle.clone();
	const texture = renderer.generateTexture({
		target: actor.container,
		frame: bounds,
	});
	const tail = new Sprite({
		texture,
		eventMode: "none",
	});
	tail.position.set(bounds.x, bounds.y);
	// The snapshot excludes the root transform; retain scale, pivot and camera alignment exactly.
	const outgoing = new Container({
		eventMode: "none",
	});
	outgoing.position.copyFrom(actor.container.position);
	outgoing.scale.copyFrom(actor.container.scale);
	outgoing.pivot.copyFrom(actor.container.pivot);
	outgoing.skew.copyFrom(actor.container.skew);
	outgoing.rotation = actor.container.rotation;
	outgoing.addChild(tail);
	previousLayer.addChild(outgoing);
	layer.addChild(actor.container);
	const releaseFn = () => {
		outgoing.destroy({
			children: true,
		});
		texture.destroy(true);
	};
	yield* animator.animateFx({
		actor,
		channel: "layer-release",
		durationMs: 220,
		outgoing,
		onCancelFn: releaseFn,
		onCompleteFn: releaseFn,
	});
});
