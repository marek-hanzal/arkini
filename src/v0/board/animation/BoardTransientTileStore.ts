import { useSyncExternalStore } from "react";
import type { BoardTransientTile } from "~/v0/board/animation/BoardTransientTile";

let transientTiles: readonly BoardTransientTile[] = [];
const listeners = new Set<() => void>();

const notify = () => {
	for (const listener of listeners) listener();
};

export const readBoardTransientTiles = () => transientTiles;

const subscribeBoardTransientTiles = (listener: () => void) => {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
};

export const useBoardTransientTiles = () =>
	useSyncExternalStore(
		subscribeBoardTransientTiles,
		readBoardTransientTiles,
		readBoardTransientTiles,
	);

export const upsertBoardTransientTiles = (tiles: readonly BoardTransientTile[]) => {
	const ids = new Set(tiles.map((tile) => tile.id));
	transientTiles = [
		...transientTiles.filter((tile) => !ids.has(tile.id)),
		...tiles,
	];
	notify();
};

export const removeBoardTransientTilesByGroup = (groupId: string) => {
	const next = transientTiles.filter((tile) => tile.groupId !== groupId);
	if (next.length === transientTiles.length) return;

	transientTiles = next;
	notify();
};

export const clearBoardTransientTiles = () => {
	if (transientTiles.length === 0) return;

	transientTiles = [];
	notify();
};
