import type { Container, Graphics, Sprite, Text } from "pixi.js";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";

export interface VisualReadyListener {
	readonly onCancelFn?: () => void;
	readonly onReadyFn: () => void;
}

/**
 * One atomic tile face revision.
 *
 * A canonical actor may retain several visual revisions while a replacement blends. Texture
 * readiness therefore belongs to this physical visual slot, never to the canonical actor ID.
 */
export interface ActorVisual {
	readonly container: Container;
	readonly primary: Sprite;
	readonly composite: Sprite;
	readonly badge: Text;
	readonly badgeBackground: Graphics;
	readonly readyListeners: Set<VisualReadyListener>;
	readonly releaseTexturesFn: () => void;
	readonly reportCriticalFailureFn: (cause: unknown) => void;
	item: TileActorItem;
	size: number;
	textureGeneration: number;
	textureState: "destroyed" | "failed" | "loading" | "ready";
}
