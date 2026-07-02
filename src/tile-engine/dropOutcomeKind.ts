import type { TileEngine } from "~/tile-engine/TileEngine.types";

export const dropOutcomeKind = (outcome: TileEngine.DropOutcome | undefined) =>
	typeof outcome === "string" ? outcome : (outcome?.type ?? "reject");
