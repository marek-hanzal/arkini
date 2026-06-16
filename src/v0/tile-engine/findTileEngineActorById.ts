export const findTileEngineActorById = (tileId: string) =>
	document.querySelector<HTMLElement>(`[data-ak-tile-engine-tile-id="${CSS.escape(tileId)}"]`) ??
	null;
