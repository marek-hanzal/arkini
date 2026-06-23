import { z } from "zod";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import { ViewItemSchema, type ViewItem } from "./ViewItemSchema";

const ItemCatalogViewSchema = z.record(z.string(), ViewItemSchema);

export type ItemCatalogView = Partial<Record<ItemId, ViewItem>>;
