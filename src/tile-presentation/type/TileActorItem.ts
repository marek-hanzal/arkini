import type { readRuntimeItemPrimaryActionFx } from "~/item-interaction/fx/readRuntimeItemPrimaryActionFx";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { TileActorVisual } from "~/tile-presentation/type/TileActorVisual";

/** One exact live grid identity projected for the shared Canvas tile actor layer. */
export interface TileActorItem extends TileActorVisual {
	readonly badgeCount?: number;
	readonly badgeKind?: "units" | "queue";
	readonly id: string;
	readonly revision: string;
	readonly location: BoardLocationSchema.Type;
	readonly progressRatio?: number;
	readonly clockPulse?: {
		readonly intervalMs: number;
		readonly remainingMs: number;
		readonly enabled: boolean;
	};
	/** Waiting-cursor presentation; instant jobs never flash a wait. */
	readonly running: boolean;
	readonly primaryAction: readRuntimeItemPrimaryActionFx.Result;
}
