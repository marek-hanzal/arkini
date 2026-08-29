import {
	Container,
	Graphics,
	Particle,
	ParticleContainer,
	Sprite,
	Text,
	TextStyle,
	Texture,
} from "pixi.js";

import type { TileActorItem } from "~/ui/pixi/actor/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { ActorVisual } from "~/ui/pixi/actor/ActorVisual";

export const item = {
	id: "runtime:log",
	itemId: "log",
	itemType: "simple",
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
	quantity: 1,
	revision: "revision:log",
	running: false,
	activityEffect: false,
	sourceUrl: "resource:log",
	title: "Log",
} satisfies TileActorItem;

export const createItem = (id: string, x: number): TileActorItem => ({
	...item,
	id,
	itemId: id,
	location: {
		...item.location,
		position: {
			x,
			y: 0,
		},
	},
	revision: `revision:${id}`,
	title: id,
});

export const createDragActor = (actorItem: TileActorItem): PixiTileActor => {
	const container = new Container();
	container.cursor = "grab";
	container.position.set(10, 20);
	const lifecycleLayer = new Container();
	const offsetLayer = new Container();
	lifecycleLayer.addChild(offsetLayer);
	container.addChild(lifecycleLayer);
	const titleStyle = new TextStyle();
	const visual = {
		composite: new Sprite(Texture.EMPTY),
		container: new Container(),
		item: actorItem,
		primary: new Sprite(Texture.EMPTY),
		quantity: new Text({
			text: String(actorItem.quantity),
		}),
		quantityBackground: new Graphics(),
		readyListeners: new Set(),
		reportCriticalFailure: () => {},
		size: 80,
		textureGeneration: 0,
		textureState: "ready",
		title: new Text({
			style: titleStyle,
			text: actorItem.title,
		}),
		titleBackground: new Graphics(),
		titleStyle,
	} satisfies ActorVisual;
	const particle = new Particle(Texture.EMPTY);
	const activityParticleContainer = new ParticleContainer({
		particles: [
			particle,
		],
		texture: Texture.EMPTY,
	});
	activityParticleContainer.visible = false;
	return {
		activityParticles: {
			centerX: 40,
			container: activityParticleContainer,
			feedbackPhase: null,
			lastProgress: 0,
			lightSurface: false,
			particles: [
				{
					alphaScale: 1,
					particle,
					phaseOffset: 0,
					spreadOffset: 0,
					speedCycles: 1,
					waveOffset: 0,
				},
			],
			startY: 68,
			topHalfWidth: 24,
			topY: -18,
			workingTint: 0xf05bb8,
		},
		container,
		crowdLayer: new Container(),
		currentVisual: visual,
		dragging: false,
		dragOffsetX: 0,
		dragOffsetY: 0,
		instanceId: `test:${actorItem.id}`,
		item: actorItem,
		lifecycleLayer,
		lifecycleDurationMs: 0,
		lifecycleTransitionStarted: false,
		lifecycleIntentGeneration: 0,
		lifecycleNotBeforeMs: 0,
		lifecycleTargetAlpha: 1,
		offsetLayer,
		onPointerDown: null,
		pendingVisual: null,
		progressBar: new Graphics(),
		size: 80,
		visualLayer: new Container(),
		visuals: new Set([
			visual,
		]),
		visualTransitionGeneration: 0,
	};
};
