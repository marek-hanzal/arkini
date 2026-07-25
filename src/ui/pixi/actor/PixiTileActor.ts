import type { Container, FederatedPointerEvent, Graphics, Sprite, Text, TextStyle } from "pixi.js";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";

export interface PixiTileActor {
	readonly container: Container;
	readonly crowdLayer: Container;
	readonly primary: Sprite;
	readonly composite: Sprite;
	readonly title: Text;
	readonly titleBackground: Graphics;
	readonly quantity: Text;
	readonly quantityBackground: Graphics;
	readonly titleStyle: TextStyle;
	item: TileActorItem;
	size: number;
	textureGeneration: number;
	dragging: boolean;
	dragOffsetX: number;
	dragOffsetY: number;
	onPointerDown: ((event: FederatedPointerEvent) => void) | null;
}
