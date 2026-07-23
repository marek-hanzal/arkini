import { Effect } from "effect";

import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";
import { readLineOwnerLines } from "~/engine/line/read/readLineOwnerLines";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readRuntimeItemPrimaryActionFx {
	export type Result =
		| {
				readonly kind: "none";
		  }
		| {
				readonly kind: "open-lines";
		  }
		| {
				readonly kind: "start-default-line";
				readonly lineId: string;
		  };

	export interface Props {
		readonly item: RuntimeItemSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Resolves the canonical single-click action of one exact live item. */
export const readRuntimeItemPrimaryActionFx = Effect.fn("readRuntimeItemPrimaryActionFx")(
	function* ({ item, runtime }: readRuntimeItemPrimaryActionFx.Props) {
		if (!isLineOwnerItem(item.item)) {
			return {
				kind: "none" as const,
			} satisfies readRuntimeItemPrimaryActionFx.Result;
		}
		const defaultLineId = runtime.defaultLineByOwnerItemId?.[item.id];
		if (
			defaultLineId !== undefined &&
			readLineOwnerLines(item.item).some((line) => line.id === defaultLineId)
		) {
			return {
				kind: "start-default-line" as const,
				lineId: defaultLineId,
			} satisfies readRuntimeItemPrimaryActionFx.Result;
		}
		return {
			kind: "open-lines" as const,
		} satisfies readRuntimeItemPrimaryActionFx.Result;
	},
);
