import { z } from "zod";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import { ViewItemSchema, type ViewItem } from "./ViewItemSchema";

export const ItemCatalogViewSchema = z.record(z.string(), ViewItemSchema);

type ItemCatalogViewSchema = typeof ItemCatalogViewSchema;
export namespace ItemCatalogViewSchema {
	export type Type = z.infer<ItemCatalogViewSchema>;
}

export type ItemCatalogView = Partial<Record<ItemId, ViewItem>>;
