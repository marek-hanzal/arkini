import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";

/** Keeps every active production owner visibly occupied, including blocked jobs. */
export const readCrowdAlphaFn = (item: TileActorItem) => (item.jobStatus === undefined ? 1 : 0.6);
