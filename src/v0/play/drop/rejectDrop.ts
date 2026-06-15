import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export const rejectDrop = (feedback?: () => void): TileEngine.DropOutcome => {
	feedback?.();
	return "reject";
};
