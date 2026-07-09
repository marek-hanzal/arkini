import type { TileEngine } from "~/tile-engine/TileEngine.types";

export const rejectDrop = (feedback?: () => void): TileEngine.DropOutcome => {
	feedback?.();
	return "reject";
};
