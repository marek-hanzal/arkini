import type { TileEngineSlot } from "~/v0/tile-engine/TileEngineSlot";
import { sameOptionalTileEngineTile } from "~/v0/tile-engine/sameOptionalTileEngineTile";
import { sameTileEngineDropFeedback } from "~/v0/tile-engine/sameTileEngineDropFeedback";
import { sameTileEngineSlot } from "~/v0/tile-engine/sameTileEngineSlot";

export const sameTileEngineSlotProps = <TTile, TSlot, TDrop>(
	left: TileEngineSlot.Props<TTile, TSlot, TDrop>,
	right: TileEngineSlot.Props<TTile, TSlot, TDrop>,
) =>
	sameTileEngineSlot(left.slot, right.slot) &&
	left.index === right.index &&
	sameOptionalTileEngineTile(left.targetTile, right.targetTile) &&
	sameTileEngineDropFeedback(left.dropFeedback, right.dropFeedback) &&
	left.disabled === right.disabled &&
	left.className === right.className &&
	left.dragRef === right.dragRef &&
	left.renderSlot === right.renderSlot &&
	left.registerDrop === right.registerDrop;
