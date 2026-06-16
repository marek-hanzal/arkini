import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";

export const rejectDrop = (feedback?: () => void): TileEngine.DropOutcome => {
	feedback?.();
	return "reject";
};
