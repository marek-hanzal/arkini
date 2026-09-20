import { Effect } from "effect";
import type { Container } from "pixi.js";

import type { ActorPose } from "~/game-scene/type/ActorPose";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import { readVisibleArtworkOccupantsFx } from "~/tile-rendering/fx/readVisibleArtworkOccupantsFx";
import { runActorLifecycleFx } from "~/tile-rendering/fx/runActorLifecycleFx";

/** Chooses birth feedback from physical artwork, including actors already leaving canonical storage. */
export const prepareActorBirthFx = Effect.fn("prepareActorBirthFx")(function* ({
	actor,
	actorStore,
	animator,
	pose,
	transientActorLayer,
}: {
	readonly actor: PixiTileActor;
	readonly actorStore: MainActorStore;
	readonly animator: ActorAnimator;
	readonly pose: ActorPose;
	readonly transientActorLayer: Container;
}) {
	const presentedActors = [
		...actorStore.actors.values(),
		...actorStore.exitingActors,
	];
	const layers = new Set([
		pose.layer,
		transientActorLayer,
	]);
	for (const presented of presentedActors) {
		if (presented.container.parent !== null) layers.add(presented.container.parent);
	}
	const occupants = yield* readVisibleArtworkOccupantsFx({
		pose,
		layers: [
			...layers,
		],
		exclude: actor.container,
	});
	for (const outgoing of presentedActors) {
		if (
			!occupants.includes(outgoing.container) ||
			actorStore.canonicalItems.has(outgoing.item.id)
		)
			continue;
		// Preserve the presented size; an already fading replacement must not keep shrinking.
		yield* animator.cancelChannelFx(outgoing, "lifecycle-scale");
		outgoing.lifecycleAnimateScale = false;
	}
	yield* runActorLifecycleFx({
		actor,
		animator,
		animateScale: occupants.length === 0,
		kind: "prepare-enter",
	});
});
