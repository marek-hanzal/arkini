import type { ReactNode, RefObject } from "react";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace TileEngineSlot {
	export interface Props<TTile = unknown, TSlot = unknown, TDrop = unknown> {
		layerRole: TileEngine.LayerRole;
		slot: TileEngine.Slot<TSlot>;
		index: number;
		targetTile?: TileEngine.Tile<TTile>;
		dropFeedback: TileEngine.ActiveDropFeedback | null;
		disabled?: boolean;
		className?: string;
		dragRef: RefObject<TileEngine.DragConfig<TTile, TSlot, unknown, TDrop> | undefined>;
		renderSlot(props: TileEngine.RenderSlotProps<TSlot>): ReactNode;
		registerDrop(entry: TileEngineDrop.Registration<TSlot, TTile, TDrop>): () => void;
	}
}
