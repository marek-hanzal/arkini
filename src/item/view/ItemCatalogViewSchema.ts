import type { ItemId } from "~/config/GameIdSchema";
import type { ViewItem } from "./ViewItemSchema";

export type ItemCatalogView = Partial<Record<ItemId, ViewItem>>;
