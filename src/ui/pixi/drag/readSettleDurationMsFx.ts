import { Effect } from "effect";

export namespace readSettleDurationMsFx {
	export interface Props {
		readonly fromX: number;
		readonly fromY: number;
		readonly tileSize: number;
		readonly toX: number;
		readonly toY: number;
	}
}

const minimumDurationMs = 125;
const maximumDurationMs = 240;
const durationPerTileMs = 18;

/** Keeps a released tile responsive while preserving readable travel across a distant board. */
export const readSettleDurationMsFx = Effect.fn("readSettleDurationMsFx")(
	({ fromX, fromY, tileSize, toX, toY }: readSettleDurationMsFx.Props) =>
		Effect.sync(() => {
			const distanceInTiles = Math.hypot(toX - fromX, toY - fromY) / Math.max(1, tileSize);
			return Math.min(
				maximumDurationMs,
				Math.max(
					minimumDurationMs,
					minimumDurationMs + distanceInTiles * durationPerTileMs,
				),
			);
		}),
);
