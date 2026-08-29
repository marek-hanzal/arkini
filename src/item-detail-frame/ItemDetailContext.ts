import { createContext } from "react";

import type { ItemDetailControl } from "~/item-detail-frame/ItemDetailControl";

/** Active game-shell Item Detail control. */
export const ItemDetailContext = createContext<ItemDetailControl | undefined>(undefined);
