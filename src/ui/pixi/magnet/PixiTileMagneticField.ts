import type { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";

export interface PixiTileMagneticField {
	readonly pruneFx: Effect.Effect<void>;
	readonly resetFx: Effect.Effect<void>;
	readonly updateFx: (sample: {
		readonly attractedActorId: string | null;
		readonly sourceActorId: string;
		readonly sourceDirection: {
			readonly x: number;
			readonly y: number;
		} | null;
		readonly sourceItem: TileActorItem;
		readonly sourceX: number;
		readonly sourceY: number;
	}) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
