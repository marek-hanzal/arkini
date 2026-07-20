import { createContext } from "react";

import type { ItemDetailControl } from "~/ui/item-detail/ItemDetailControl";

/** Active game-shell Item Detail control. */
export const ItemDetailContext = createContext<ItemDetailControl | undefined>(undefined);
