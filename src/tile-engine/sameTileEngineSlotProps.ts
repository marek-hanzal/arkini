import type { TileEngineSlot } from "~/tile-engine/TileEngineSlot.types";
import { sameOptionalTileEngineTile } from "~/tile-engine/sameOptionalTileEngineTile";
import { sameTileEngineDropFeedback } from "~/tile-engine/sameTileEngineDropFeedback";
import { sameTileEngineSlot } from "~/tile-engine/sameTileEngineSlot";

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
