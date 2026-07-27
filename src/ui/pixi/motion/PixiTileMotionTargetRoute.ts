import type { TileActorItem } from "~/bridge/tile/TileActorItem";

export interface PixiTileMotionTargetRoute {
	readonly actorId: string;
	readonly location: TileActorItem["location"];
	readonly redirected: boolean;
}

export interface PixiTileMotionTargetRedirect {
	readonly sourceActorId: string;
	readonly targetActorId: string;
	readonly targetLocation: TileActorItem["location"];
}
