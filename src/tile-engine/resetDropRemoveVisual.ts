import { readTileEngineActorVisual } from "~/tile-engine/readTileEngineActorVisual";

export const resetDropRemoveVisual = (actor: HTMLElement | null) => {
	const visual = readTileEngineActorVisual(actor);
	if (!visual) return;

	visual.style.filter = "";
	visual.style.opacity = "";
	visual.style.transform = "";
};
