import type { Container, Graphics, Sprite, Text, TextStyle } from "pixi.js";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";

export interface PixiTileActorVisualReadyListener {
	readonly onCancel?: () => void;
	readonly onReady: () => void;
}

/**
 * One atomic tile face revision.
 *
 * A canonical actor may retain several visual revisions while a replacement blends. Texture
 * readiness therefore belongs to this physical visual slot, never to the canonical actor ID.
 */
export interface PixiTileActorVisual {
	readonly container: Container;
	readonly primary: Sprite;
	readonly composite: Sprite;
	readonly title: Text;
	readonly titleBackground: Graphics;
	readonly quantity: Text;
	readonly quantityBackground: Graphics;
	readonly titleStyle: TextStyle;
	readonly readyListeners: Set<PixiTileActorVisualReadyListener>;
	item: TileActorItem;
	size: number;
	textureGeneration: number;
	textureState: "destroyed" | "failed" | "loading" | "ready";
}
