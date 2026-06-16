import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

const sameSlotData = <TSlot>(left: TileEngine.Slot<TSlot>, right: TileEngine.Slot<TSlot>) => {
	if (left.renderKey !== undefined || right.renderKey !== undefined) {
		return left.renderKey === right.renderKey;
	}

	return Object.is(left.data, right.data);
};

/**
 * Shallow identity check for memoized TileEngine slot props.
 *
 * `renderKey` is the adapter-owned equality token for slot renderer data.
 */
export const sameTileEngineSlot = <TSlot>(
	left: TileEngine.Slot<TSlot>,
	right: TileEngine.Slot<TSlot>,
) =>
	left.id === right.id &&
	left.dropId === right.dropId &&
	left.disabled === right.disabled &&
	sameSlotData(left, right);
