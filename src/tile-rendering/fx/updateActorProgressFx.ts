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
	const inset = (size * (1 - actor.item.artworkScale)) / 2;
	const faceSize = Math.max(1, size - inset * 2);
	const width = faceSize * 0.76;
	const height = Math.max(2, faceSize * 0.045);
	const x = inset + (faceSize - width) / 2;
	const y = Math.min(size - height, inset + faceSize + Math.max(1, (inset - height) / 2));
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

/** Updates job/lifetime progress and periodic Clock independently from the retained tile faces. */
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
	const ring = actor.clockRing;
	const pulse = item.location.scope === "board" ? item.clockPulse : undefined;
	ring.clear();
	ring.visible = pulse !== undefined;
	ring.alpha = pulse?.enabled === false ? 0.5 : 1;
	if (pulse !== undefined) {
		const inset = (size * (1 - item.artworkScale)) / 2;
		const faceSize = Math.max(1, size * item.artworkScale);
		const radius = faceSize * 0.085;
		const x = inset + radius + faceSize * 0.05;
		const y = inset + radius + faceSize * 0.05;
		const stroke = radius * 0.18;
		const color = palette.overlayForeground;
		const ratio = Math.max(0, Math.min(1, 1 - pulse.remainingMs / pulse.intervalMs));
		ring.circle(x, y, radius + stroke).fill({
			color: palette.overlay,
			alpha: 0.72,
		});
		ring.circle(x, y, radius).stroke({
			color: palette.overlayForeground,
			alpha: 0.2,
			width: stroke,
		});
		if (ratio > 0)
			ring.moveTo(x, y - radius)
				.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio)
				.stroke({
					color,
					alpha: 1,
					width: stroke,
				});
		ring.moveTo(x, y - radius * 0.5)
			.lineTo(x, y)
			.lineTo(x + radius * 0.35, y + radius * 0.2)
			.stroke({
				color,
				alpha: 1,
				width: stroke,
				cap: "round",
				join: "round",
			});
	}
	yield* frames.invalidateFx;
});
