import { Container, Graphics, Sprite, Text, Texture, UniformGroup } from "pixi.js";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorVisual } from "~/tile-rendering/type/ActorVisual";

export const item = {
	artworkScale: 0.8,
	id: "runtime:log",
	itemUid: "log",

	location: {
		scope: "board",
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	primaryAction: {
		kind: "none",
	},
	revision: "revision:log",
	running: false,

	sourceUrl: "resource:log",
} satisfies TileActorItem;

export const createItem = (id: string, x: number): TileActorItem => ({
	...item,
	id,
	itemUid: id,
	location: {
		...item.location,
		position: {
			x,
			y: 0,
		},
	},
	revision: `revision:${id}`,
});

export const createDragActor = (actorItem: TileActorItem): PixiTileActor => {
	const container = new Container();
	container.cursor = "grab";
	container.position.set(10, 20);
	const lifecycleLayer = new Container();
	const hoverLayer = new Container();
	lifecycleLayer.addChild(hoverLayer);
	const infoButton = new Graphics();
	infoButton.visible = false;
	container.addChild(lifecycleLayer);
	const visual = {
		composite: new Sprite(Texture.EMPTY),
		container: new Container(),
		item: actorItem,
		primary: new Sprite(Texture.EMPTY),
		badge: new Text({
			text: "",
		}),
		badgeBackground: new Graphics(),
		readyListeners: new Set(),
		releaseTexturesFn: () => {},
		reportCriticalFailureFn: () => {},
		size: 80,
		textureGeneration: 0,
		textureState: "ready",
		unitsFadeFilter: {
			destroy: () => {},
		} as ActorVisual["unitsFadeFilter"],
		unitsFadeUniforms: new UniformGroup({
			uColorFraction: {
				value: 1,
				type: "f32",
			},
		}),
	} satisfies ActorVisual;
	return {
		container,
		currentVisual: visual,
		dragging: false,
		dragOffsetX: 0,
		dragOffsetY: 0,
		instanceId: `test:${actorItem.id}`,
		item: actorItem,
		lifecycleLayer,
		hoverLayer,
		infoButton,
		onPointerDownFn: null,
		onPointerEnterFn: null,
		onPointerLeaveFn: null,
		pendingVisual: null,
		progressBar: new Graphics(),
		clockRing: new Graphics(),
		size: 80,
		visualLayer: new Container(),
		visuals: new Set([
			visual,
		]),
		visualTransitionGeneration: 0,
	};
};
