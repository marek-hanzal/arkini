import { Option } from "effect";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

/** Selects an item that exposes at least one production line. */
export const narrowLineOwnerItemFn = (item: ItemSchema.Type): Option.Option<ItemSchema.Type> =>
	Option.liftPredicate(item, (candidate) => candidate.lines.length > 0);
