import type { TileEngineActor } from "~/v0/tile-engine/TileEngineActor.types";
import { sameTileEngineDropFeedback } from "~/v0/tile-engine/sameTileEngineDropFeedback";
import { sameTileEngineTile } from "~/v0/tile-engine/sameTileEngineTile";

export const sameTileEngineActorProps = <TTile, TSlot, TDrag, TDrop>(
	left: TileEngineActor.Props<TTile, TSlot, TDrag, TDrop>,
	right: TileEngineActor.Props<TTile, TSlot, TDrag, TDrop>,
) =>
	sameTileEngineTile(left.tile, right.tile) &&
	left.index === right.index &&
	left.columns === right.columns &&
	left.rowCount === right.rowCount &&
	left.gapPx === right.gapPx &&
	left.enter === right.enter &&
	left.exit === right.exit &&
	left.feedback === right.feedback &&
	left.dragRef === right.dragRef &&
	left.dragDisabled === right.dragDisabled &&
	left.dragConstraintsRef === right.dragConstraintsRef &&
	left.resolveDrop === right.resolveDrop &&
	sameTileEngineDropFeedback(left.dropFeedback, right.dropFeedback) &&
	left.setActiveDropId === right.setActiveDropId &&
	left.setActiveDropFeedback === right.setActiveDropFeedback &&
	left.setHandoff === right.setHandoff &&
	left.setHandoffs === right.setHandoffs &&
	left.consumeHandoff === right.consumeHandoff &&
	left.renderTile === right.renderTile;
