import { Effect } from "effect";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { DemandFrameLoop } from "~/tile-rendering/service/DemandFrameLoop";

export namespace updateActorProgressFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly frames: DemandFrameLoop;
		readonly item: TileActorItem;
		readonly palette: PixiScenePalette;
		readonly size: number;
	}
}

const tileToSlotRatio = 0.8;

const updateProgressBarFn = ({
	actor,
	palette,
	size,
}: {
	readonly actor: PixiTileActor;
	readonly palette: PixiScenePalette;
	readonly size: number;
}) => {
	const progressRatio = actor.item.progressRatio;
	actor.progressBar.clear();
	actor.progressBar.visible = progressRatio !== undefined;
	if (progressRatio === undefined) return;
	const inset = (size * (1 - tileToSlotRatio)) / 2;
	const faceSize = Math.max(1, size - inset * 2);
	const width = faceSize * 0.76;
	const height = Math.max(2, faceSize * 0.045);
	const x = inset + (faceSize - width) / 2;
	const y = inset + faceSize + Math.max(1, (inset - height) / 2);
	const radius = height / 2;
	actor.progressBar.roundRect(x, y, width, height, radius).fill({
		alpha: 0.62,
		color: palette.overlay,
	});
	if (progressRatio <= 0) return;
	actor.progressBar.roundRect(x, y, width * progressRatio, height, radius).fill({
		alpha: 0.96,
		color: palette.accent,
	});
};

/** Updates the 10 Hz job overlay without remeasuring or rebuilding either retained tile face. */
export const updateActorProgressFx = Effect.fnUntraced(function* ({
	actor,
	frames,
	item,
	palette,
	size,
}: updateActorProgressFx.Props) {
	actor.item = item;
	updateProgressBarFn({
		actor,
		palette,
		size,
	});
	yield* frames.invalidateFx;
});
