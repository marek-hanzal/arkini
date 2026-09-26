import type { Container, FederatedPointerEvent, Graphics } from "pixi.js";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { ActorVisual } from "~/tile-rendering/type/ActorVisual";

export interface PixiTileActor {
	readonly instanceId: string;
	readonly container: Container;
	readonly lifecycleLayer: Container;
	readonly hoverLayer: Container;
	readonly infoButton: Container;
	readonly infoShadow: Graphics;
	readonly visualLayer: Container;
	readonly progressBar: Graphics;
	readonly clockRing: Graphics;
	readonly visuals: Set<ActorVisual>;
	currentVisual: ActorVisual;
	pendingVisual: ActorVisual | null;
	item: TileActorItem;
	size: number;
	visualTransitionGeneration: number;
	dragging: boolean;
	dragOffsetX: number;
	dragOffsetY: number;
	onPointerDownFn: ((event: FederatedPointerEvent) => void) | null;
	onPointerEnterFn: ((event: FederatedPointerEvent) => void) | null;
	onPointerLeaveFn: ((event: FederatedPointerEvent) => void) | null;
}
