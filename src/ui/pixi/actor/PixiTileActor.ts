import type { Container, FederatedPointerEvent, Sprite } from "pixi.js";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";

export interface PixiTileActor {
	readonly instanceId: string;
	readonly container: Container;
	readonly offsetLayer: Container;
	readonly crowdLayer: Container;
	readonly visualLayer: Container;
	readonly runningGlow: Sprite;
	readonly visuals: Set<PixiTileActorVisual>;
	feedbackGlowPhase: "falling" | "rising" | null;
	workingGlowTint: number;
	currentVisual: PixiTileActorVisual;
	pendingVisual: PixiTileActorVisual | null;
	item: TileActorItem;
	size: number;
	visualTransitionGeneration: number;
	lifecycleIntentGeneration: number;
	lifecycleFadeStarted: boolean;
	lifecycleTargetAlpha: number;
	lifecycleNotBeforeMs: number;
	lifecycleDurationMs: number;
	dragging: boolean;
	dragOffsetX: number;
	dragOffsetY: number;
	onPointerDown: ((event: FederatedPointerEvent) => void) | null;
}
