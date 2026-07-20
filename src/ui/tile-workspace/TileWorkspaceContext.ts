import { createContext } from "react";

import type { TileWorkspaceControl } from "~/ui/tile-workspace/TileWorkspaceControl";

/** Active game-shell tile workspace control. */
export const TileWorkspaceContext = createContext<TileWorkspaceControl | undefined>(undefined);
