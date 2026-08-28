import type { TileActorItem } from "~/bridge/tile/TileActorItem";

export interface TargetRoute {
	readonly actorId: string;
	readonly location: TileActorItem["location"];
	readonly redirected: boolean;
}

export interface MotionRedirect {
	readonly sourceActorId: string;
	readonly targetActorId: string;
	readonly targetLocation: TileActorItem["location"];
}
