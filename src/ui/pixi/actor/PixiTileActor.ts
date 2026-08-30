import type { Container, FederatedPointerEvent, Graphics } from "pixi.js";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { ActivityParticles } from "~/ui/pixi/actor/ActivityParticles";
import type { ActorVisual } from "~/ui/pixi/actor/ActorVisual";

export interface PixiTileActor {
	readonly instanceId: string;
	readonly container: Container;
	readonly lifecycleLayer: Container;
	readonly offsetLayer: Container;
	readonly crowdLayer: Container;
	readonly visualLayer: Container;
	readonly activityParticles: ActivityParticles;
	readonly progressBar: Graphics;
	readonly visuals: Set<ActorVisual>;
	currentVisual: ActorVisual;
	pendingVisual: ActorVisual | null;
	item: TileActorItem;
	size: number;
	visualTransitionGeneration: number;
	lifecycleIntentGeneration: number;
	lifecycleTransitionStarted: boolean;
	lifecycleTargetAlpha: number;
	lifecycleNotBeforeMs: number;
	lifecycleDurationMs: number;
	dragging: boolean;
	dragOffsetX: number;
	dragOffsetY: number;
	onPointerDown: ((event: FederatedPointerEvent) => void) | null;
}
