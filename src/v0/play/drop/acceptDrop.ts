import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export const acceptDrop = (commit: () => Promise<unknown>): TileEngine.DropOutcome => ({
	type: "accept",
	commit,
});
