import { useContext } from "react";

import { TileActorRetentionContext } from "~/ui/tile/TileActorRetentionContext";

/** Reads the focused presentation-snapshot owner surrounding every tile actor. */
export const useTileActorRetention = () => {
	const retainActorIds = useContext(TileActorRetentionContext);
	if (retainActorIds === null) throw new Error("TileActorLayer retention owner is missing.");
	return retainActorIds;
};
