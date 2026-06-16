import type { TileExitMotionSchema } from "~/v0/tile-engine/TileExitMotionSchema";
import type { ItemId } from "~/v0/manifest/manifestId";

export interface BoardTransientTile {
	id: string;
	itemId: ItemId;
	slotId: string;
	exit: TileExitMotionSchema.Type;
}
