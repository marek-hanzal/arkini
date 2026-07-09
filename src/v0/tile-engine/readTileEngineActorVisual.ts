export const readTileEngineActorVisual = (actor: HTMLElement | null) =>
	actor?.querySelector<HTMLElement>("[data-ak-tile-engine-visual]") ?? null;
