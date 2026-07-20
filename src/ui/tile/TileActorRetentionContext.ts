import { createContext } from "react";

/** Synchronously protects exact visual snapshots before an engine command can remove them. */
export const TileActorRetentionContext = createContext<
	((itemIds: ReadonlyArray<string>) => void) | null
>(null);
