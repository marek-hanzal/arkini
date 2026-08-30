import { Effect } from "effect";
import { Container, Graphics, Particle, ParticleContainer, Rectangle, Texture } from "pixi.js";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { readParticleLightSurfaceFn } from "~/tile-rendering/fn/readParticleLightSurfaceFn";
import type { ParticleTextures } from "~/tile-rendering/service/ParticleTextures";
import type { ActivityParticles } from "~/tile-rendering/type/ActivityParticles";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import { createActorVisualFx } from "~/tile-rendering/fx/createActorVisualFx";
import { readActorCursorFn } from "~/tile-rendering/fn/readActorCursorFn";
import { readCrowdAlphaFn } from "~/tile-rendering/fn/readCrowdAlphaFn";
import type { DemandFrameLoop } from "~/tile-rendering/service/DemandFrameLoop";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";

export namespace createTileActorFx {
	export interface Props {
		readonly frames: DemandFrameLoop;
		readonly item: TileActorItem;
		readonly palette: PixiScenePalette;
		readonly particleTextures?: Pick<ParticleTextures, "star">;
		readonly textures: TextureStore;
	}
}

interface CreateActivityParticlesProps {
	readonly actorId: string;
	readonly instanceId: string;
	readonly lightSurface: boolean;
	readonly textures?: Pick<ParticleTextures, "star">;
	readonly tint: number;
}

const activityParticleCount = 12;
const goldenAngle = Math.PI * (3 - Math.sqrt(5));

/** Allocates the actor-owned particle pool before the actor enters a scene. */
const createActivityParticlesFx = Effect.fn("createActivityParticlesFx")(
	({
		actorId,
		instanceId,
		lightSurface,
		textures = {
			star: Texture.EMPTY,
		},
		tint,
	}: CreateActivityParticlesProps) =>
		Effect.sync((): ActivityParticles => {
			const particles = Array.from(
				{
					length: activityParticleCount,
				},
				(_, index) => {
					const particle = new Particle({
						alpha: 0,
						anchorX: 0.5,
						anchorY: 0.5,
						texture: textures.star,
						tint,
					});
					return {
						alphaScale: 0.84 + ((index * 37) % 17) / 100,
						particle,
						phaseOffset: index / activityParticleCount,
						spreadOffset:
							(((index * 7) % activityParticleCount) / (activityParticleCount - 1)) *
								2 -
							1,
						speedCycles: 1 + ((index * 5) % 3),
						waveOffset: index * goldenAngle,
					};
				},
			);
			const container = new ParticleContainer({
				boundsArea: new Rectangle(0, 0, 1, 1),
				dynamicProperties: {
					color: true,
					position: true,
					rotation: false,
					uvs: false,
					vertex: false,
				},
				eventMode: "none",
				label: `TileActorActivityParticles:${actorId}:${instanceId}`,
				particles: particles.map(({ particle }) => particle),
				texture: textures.star,
			});
			container.blendMode = "add";
			container.visible = false;

			return {
				centerX: 0,
				container,
				feedbackPhase: null,
				lastProgress: 0,
				lightSurface,
				particles,
				startY: 0,
				topHalfWidth: 0,
				topY: 0,
				workingTint: tint,
			};
		}),
);

let nextActorInstance = 0;

/** Creates one retained native Pixi actor; async textures are generation guarded. */
export const createTileActorFx = Effect.fn("createTileActorFx")(
	({ frames, item, palette, particleTextures, textures }: createTileActorFx.Props) =>
		Effect.gen(function* (): Effect.fn.Return<PixiTileActor> {
			nextActorInstance += 1;
			const instanceId = `pixi-tile:${nextActorInstance}`;
			const container = new Container({
				eventMode: "static",
				label: `TileActor:${item.id}:${instanceId}`,
			});
			container.cursor = readActorCursorFn({
				phase: "idle",
				previewKind: null,
				running: item.running,
			});
			const lifecycleLayer = new Container({
				eventMode: "none",
				label: `TileActorLifecycle:${item.id}:${instanceId}`,
			});
			const offsetLayer = new Container({
				eventMode: "none",
				label: `TileActorOffset:${item.id}:${instanceId}`,
			});
			const crowdLayer = new Container({
				eventMode: "none",
				label: `TileActorCrowd:${item.id}:${instanceId}`,
			});
			crowdLayer.alpha = readCrowdAlphaFn(item);
			const visualLayer = new Container({
				eventMode: "none",
				label: `TileActorVisualLayer:${item.id}:${instanceId}`,
			});
			const activityParticles = yield* createActivityParticlesFx({
				actorId: item.id,
				instanceId,
				lightSurface: readParticleLightSurfaceFn(palette),
				textures: particleTextures,
				tint: palette.accent,
			});
			activityParticles.container.blendMode = "normal";
			const progressBar = new Graphics({
				eventMode: "none",
				label: `TileActorProgress:${item.id}:${instanceId}`,
			});
			progressBar.visible = false;
			const currentVisual = yield* createActorVisualFx({
				frames,
				item,
				palette,
				size: 0,
				textures,
			});
			const visuals = new Set([
				currentVisual,
			]);
			visualLayer.addChild(currentVisual.container);
			crowdLayer.addChild(visualLayer);
			offsetLayer.addChild(crowdLayer, activityParticles.container, progressBar);
			lifecycleLayer.addChild(offsetLayer);
			container.addChild(lifecycleLayer);

			return {
				instanceId,
				container,
				lifecycleLayer,
				offsetLayer,
				crowdLayer,
				visualLayer,
				activityParticles,
				progressBar,
				visuals,
				currentVisual,
				pendingVisual: null,
				item,
				size: 0,
				visualTransitionGeneration: 0,
				lifecycleIntentGeneration: 0,
				lifecycleTransitionStarted: false,
				lifecycleTargetAlpha: 1,
				lifecycleNotBeforeMs: 0,
				lifecycleDurationMs: 0,
				dragging: false,
				dragOffsetX: 0,
				dragOffsetY: 0,
				onPointerDown: null,
			} satisfies PixiTileActor;
		}),
);
