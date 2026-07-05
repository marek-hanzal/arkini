import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";

export const readSinglePlacementCreatedAtMs = ({
	item,
	itemDefinition,
	nowMs,
}: {
	item: GameSaveItemPlacementRequest;
	itemDefinition: NonNullable<GameConfig["items"][string]>;
	nowMs: number;
}) => item.createdAtMs ?? (itemDefinition.effects?.length ? nowMs : undefined);
