import { createContext } from "react";

import type { ItemDetailControl } from "~/item-detail-frame/type/ItemDetailControl";

/** Active game-shell Item Detail control. */
export const ItemDetailContext = createContext<ItemDetailControl | undefined>(undefined);
