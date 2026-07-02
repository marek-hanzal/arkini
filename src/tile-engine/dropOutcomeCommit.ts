import type { TileEngine } from "~/tile-engine/TileEngine.types";

export const dropOutcomeCommit = (outcome: TileEngine.DropOutcome | undefined) => {
	if (typeof outcome === "string" || outcome?.type !== "accept") return undefined;
	return outcome.commit;
};
