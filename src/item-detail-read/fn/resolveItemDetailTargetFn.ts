import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace resolveItemDetailTargetFn {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Result =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies resolveItemDetailTargetFn.Result;

/** Validates one exact Item Detail target against the current runtime. */
export const resolveItemDetailTargetFn = ({
	itemId,
	runtime,
}: resolveItemDetailTargetFn.Props): resolveItemDetailTargetFn.Result => {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined) return unavailable;
	return {
		kind: "available",
		itemId: item.id,
	};
};
