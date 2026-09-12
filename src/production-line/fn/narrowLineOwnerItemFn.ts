import { Option } from "effect";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";

export namespace narrowLineOwnerItemFn {
	export type Result = Extract<
		ItemSchema.Type,
		{
			readonly type: typeof TypeSchema.enum.Common;
		}
	>;
}

/** Narrows one canonical item to the exact variants that expose product lines. */
export const narrowLineOwnerItemFn = (
	item: ItemSchema.Type,
): Option.Option<narrowLineOwnerItemFn.Result> =>
	Option.liftPredicate(
		item,
		(candidate): candidate is narrowLineOwnerItemFn.Result =>
			candidate.type === TypeSchema.enum.Common && candidate.lines.length > 0,
	);
