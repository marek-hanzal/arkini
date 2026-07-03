import { readTileEngineActorVisual } from "~/tile-engine/readTileEngineActorVisual";

export const resetDropConsumeVisual = (actor: HTMLElement | null) => {
	const visual = readTileEngineActorVisual(actor);
	if (!visual) return;

	visual.style.opacity = "";
	visual.style.transform = "";
};
