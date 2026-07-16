import type { createGameOwner } from "~/bridge/game/createGameOwner";

/** Releases the current game and rejects when its final save/disposal did not succeed. */
export const shutdownGameOwner = async (owner: createGameOwner.Owner): Promise<void> => {
	await owner.replace(null);
	const state = owner.getSnapshot();
	if (state.type === "failed") throw state.error;
};
