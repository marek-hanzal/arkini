import { readTileEngineActorVisual } from "~/tile-engine/readTileEngineActorVisual";
import {
	tileRemoveDurationSeconds,
	tileRemoveKeyframes,
	tileRemoveMotionScope,
} from "~/tile-engine/TileRemoveMotion";
import { TileEngineTiming } from "~/tile-engine/TileEngineTiming";
import { startTileStyleMotion } from "~/tile-engine/TileMotionRuntime";

export namespace animateDropRemove {
	export interface Props {
		element: HTMLElement | null;
		tileId: string;
	}
}

export const animateDropRemove = async ({
	element,
	tileId,
}: animateDropRemove.Props): Promise<boolean> => {
	const visual = readTileEngineActorVisual(element);
	if (!visual) return false;

	const result = await startTileStyleMotion({
		scope: tileRemoveMotionScope(`drop:${tileId}`),
		element: visual,
		keyframes: tileRemoveKeyframes,
		duration: tileRemoveDurationSeconds,
		ease: TileEngineTiming.moveEase,
	});

	return result.status === "completed";
};
