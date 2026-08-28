import type { Container, FederatedPointerEvent, Graphics } from "pixi.js";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActorActivityParticles } from "~/ui/pixi/actor/PixiTileActorActivityParticles";
import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";

export interface PixiTileActor {
	readonly instanceId: string;
	readonly container: Container;
	readonly lifecycleLayer: Container;
	readonly offsetLayer: Container;
	readonly crowdLayer: Container;
	readonly visualLayer: Container;
	readonly activityParticles: PixiTileActorActivityParticles;
	readonly progressBar: Graphics;
	readonly visuals: Set<PixiTileActorVisual>;
	currentVisual: PixiTileActorVisual;
	pendingVisual: PixiTileActorVisual | null;
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
