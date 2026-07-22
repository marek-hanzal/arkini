import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

type LineOwnerItem = Extract<
	RuntimeItemSchema.Type["item"],
	{
		readonly type:
			| typeof ItemEnumSchema.enum.Blueprint
			| typeof ItemEnumSchema.enum.Craft
			| typeof ItemEnumSchema.enum.Producer
			| typeof ItemEnumSchema.enum.Stash;
	}
>;

/** Reads the canonical authored lines owned by one line-capable item. */
export const readLineOwnerLines = (item: LineOwnerItem): readonly LineSchema.Type[] =>
	item.type === ItemEnumSchema.enum.Producer
		? item.lines
		: [
				item.line,
			];
