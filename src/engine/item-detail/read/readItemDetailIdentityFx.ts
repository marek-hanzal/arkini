import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readRuntimeItemDefaultAssetIdsFx } from "~/engine/item/read/readRuntimeItemDefaultAssetIdsFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readItemDetailIdentityFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Result =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly title: string;
				readonly sourceResourceIds: readonly [
					IdSchema.Type,
					...IdSchema.Type[],
				];
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies readItemDetailIdentityFx.Result;

/** Projects the shared authored identity rendered by the shared Item Detail header. */
export const readItemDetailIdentityFx = Effect.fn("readItemDetailIdentityFx")(function* ({
	itemId,
	runtime,
}: readItemDetailIdentityFx.Props) {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined) return unavailable;
	return {
		kind: "available" as const,
		itemId: item.id,
		title: item.item.title,
		sourceResourceIds: yield* readRuntimeItemDefaultAssetIdsFx({
			item: item.item,
		}),
	} satisfies readItemDetailIdentityFx.Result;
});
