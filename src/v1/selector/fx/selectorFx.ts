import { Effect } from "effect";
import { match } from "ts-pattern";

import type { BaseItemSchema } from "~/v1/item/schema/BaseItemSchema";
import type { SelectorSchema } from "~/v1/selector/schema/SelectorSchema";
import { selectorItemFx } from "./selectorItemFx";
import { selectorTagFx } from "./selectorTagFx";

export namespace selectorFx {
	export interface Props {
		selector: SelectorSchema.Type;
		item: BaseItemSchema.Type;
	}

	export type Result = boolean;
}

/** Dispatches an item selector to its specialized matching strategy. */
export const selectorFx = Effect.fn("selectorFx")(function* ({ selector, item }: selectorFx.Props) {
	const result = yield* match(selector)
		.with(
			{
				type: "item",
			},
			(selector) => {
				return selectorItemFx({
					selector,
					item,
				});
			},
		)
		.with(
			{
				type: "tag",
			},
			(selector) => {
				return selectorTagFx({
					selector,
					item,
				});
			},
		)
		.exhaustive();

	return result satisfies selectorFx.Result;
});
