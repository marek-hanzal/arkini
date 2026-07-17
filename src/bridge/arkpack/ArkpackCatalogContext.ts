import { createContext } from "react";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";

export const ArkpackCatalogContext = createContext<ArkpackCatalog | undefined>(undefined);
