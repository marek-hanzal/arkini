import { readTileEngineActorVisual } from "~/tile-engine/readTileEngineActorVisual";
import { TileEngineTiming } from "~/tile-engine/TileEngineTiming";
import { startTileStyleMotion } from "~/tile-engine/TileMotionRuntime";

export namespace animateDropConsume {
	export interface Props {
		element: HTMLElement | null;
		tileId: string;
	}
}

export const animateDropConsume = async ({
	element,
	tileId,
}: animateDropConsume.Props): Promise<boolean> => {
	const visual = readTileEngineActorVisual(element);
	if (!visual) return false;

	const result = await startTileStyleMotion({
		scope: `tile-drop-consume:${tileId}`,
		element: visual,
		keyframes: {
			opacity: [
				1,
				0,
			],
			transform: [
				"translate3d(0px, 0px, 0px) scale(1)",
				"translate3d(0px, 4px, 0px) scale(0.55)",
			],
		},
		duration: TileEngineTiming.snapDurationSeconds,
		ease: TileEngineTiming.moveEase,
	});

	return result.status === "completed";
};
