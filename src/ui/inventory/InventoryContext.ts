import { createContext } from "react";

import type { InventoryControl } from "~/ui/inventory/InventoryControl";

/** Active game-shell Inventory presentation control. */
export const InventoryContext = createContext<InventoryControl | undefined>(undefined);
