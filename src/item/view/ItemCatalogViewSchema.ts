import type { ItemId } from "~/config/IdSchema";
import type { ViewItem } from "./ViewItemSchema";

export type ItemCatalogView = Partial<Record<ItemId, ViewItem>>;
