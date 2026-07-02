import type { TileEngineNamespace as TileEngine } from "~/tile-engine";

export const rejectDrop = (feedback?: () => void): TileEngine.DropOutcome => {
	feedback?.();
	return "reject";
};
