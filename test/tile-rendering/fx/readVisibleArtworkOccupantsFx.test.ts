// @vitest-environment jsdom

import { Effect } from "effect";
import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { describe, expect, it } from "vitest";

import { readVisibleArtworkOccupantsFx } from "~/tile-rendering/fx/readVisibleArtworkOccupantsFx";

const addArtworkFn = (layer: Container, x: number) => {
	const root = new Container();
	root.x = x;
	const artwork = new Sprite(Texture.WHITE);
	artwork.width = 80;
	artwork.height = 80;
	root.addChild(artwork);
	layer.addChild(root);
	return {
		root,
		artwork,
	};
};

describe("physical artwork occupancy", () => {
	it("finds exiting and transient artwork by actual pose across transformed layers", () => {
		const stage = new Container();
		stage.position.set(50, 30);
		stage.scale.set(2);
		const layer = stage.addChild(new Container());
		const transient = stage.addChild(new Container());
		transient.x = 100;
		const exiting = addArtworkFn(layer, 100);
		exiting.root.alpha = 0.2;
		const flying = addArtworkFn(transient, 0);
		const incoming = addArtworkFn(layer, 100);
		addArtworkFn(layer, 200);
		expect(
			Effect.runSync(
				readVisibleArtworkOccupantsFx({
					pose: {
						layer,
						x: 100,
						y: 0,
						size: 100,
					},
					layers: [
						layer,
						transient,
						layer,
					],
					exclude: incoming.root,
				}),
			),
		).toEqual([
			exiting.root,
			flying.root,
		]);
	});

	it.each([
		"transparent",
		"hidden",
		"unrenderable",
		"unready",
		"hidden-parent",
		"zero-scale",
	] as const)("does not suppress birth scale for %s artwork or non-artwork graphics", (state) => {
		const layer = new Container();
		const { root, artwork } = addArtworkFn(layer, 0);
		if (state === "transparent") root.alpha = 0;
		if (state === "zero-scale") root.scale.set(0);
		if (state === "hidden") artwork.visible = false;
		if (state === "unrenderable") root.renderable = false;
		if (state === "unready") artwork.texture = Texture.EMPTY;
		if (state === "hidden-parent") layer.alpha = 0;
		layer.addChild(new Graphics().rect(0, 0, 100, 100).fill(0xffffff));
		expect(
			Effect.runSync(
				readVisibleArtworkOccupantsFx({
					pose: {
						layer,
						x: 0,
						y: 0,
						size: 100,
					},
					layers: [
						layer,
					],
					exclude: new Container(),
				}),
			),
		).toEqual([]);
	});
});
