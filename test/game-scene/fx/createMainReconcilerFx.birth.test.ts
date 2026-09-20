import { describe, expect, it } from "vitest";
import { Container, Sprite, Texture } from "pixi.js";
import { Effect } from "effect";

import { runVisualReadinessFx } from "~/tile-rendering/fx/runVisualReadinessFx";
import {
	boardLocation,
	createActor,
	createItem,
	createReconcilerHarness,
	projectionProbeState,
	transition,
} from "./createMainReconcilerFx.test/fixture";

describe("birth over physical artwork", () => {
	it.each([
		"visible",
		"fading",
		"other-layer",
		"moved",
		"transparent",
	])("uses presented occupancy when the previous actor is %s", (state) => {
		const old = createActor(createItem("runtime:old", boardLocation));
		const harness = createReconcilerHarness({
			actor: old,
		});
		const artwork = new Sprite(Texture.WHITE);
		artwork.width = 40;
		artwork.height = 40;
		old.container.addChild(artwork);
		old.container.position.set(state === "moved" ? 1000 : 100, 40);
		old.container.alpha = state === "transparent" ? 0 : 1;
		const stage = new Container();
		stage.addChild(harness.layer, harness.transientActorLayer);
		const oldLayer = state === "other-layer" ? stage.addChild(new Container()) : harness.layer;
		oldLayer.addChild(old.container);
		if (state === "fading") Effect.runSync(harness.store.releaseActorFx(old.item.id));
		const incomingItem = createItem("runtime:new", boardLocation);
		projectionProbeState.main = [
			incomingItem,
		];
		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		const incoming = harness.actors.get(incomingItem.id);
		if (!incoming) throw new Error("Expected new actor");
		Effect.runSync(
			runVisualReadinessFx({
				kind: "complete",
				visual: incoming.currentVisual,
				generation: incoming.currentVisual.textureGeneration,
			}),
		);
		const occupied = state === "visible" || state === "fading" || state === "other-layer";
		expect(
			harness.animations.some(
				(animation) =>
					animation.actor === incoming && animation.channel === "lifecycle-scale",
			),
		).toBe(!occupied);
		expect(
			harness.animations.some(
				(animation) =>
					animation.actor === incoming &&
					animation.channel === "lifecycle-opacity" &&
					animation.toAlpha === 1,
			),
		).toBe(true);
		if (occupied)
			expect(harness.canceledChannels).toContainEqual({
				actor: old,
				channel: "lifecycle-scale",
			});
	});
});
