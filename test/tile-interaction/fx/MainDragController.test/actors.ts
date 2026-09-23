import { Container, Graphics, Particle, ParticleContainer, Sprite, Text, Texture } from "pixi.js";

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
	activityEffect: false,
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
		lifecycleAnimateScale: true,
		lifecycleTransitionStarted: false,
		lifecycleIntentGeneration: 0,
		lifecycleNotBeforeMs: 0,
		lifecycleTargetAlpha: 1,
		onPointerDownFn: null,
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
