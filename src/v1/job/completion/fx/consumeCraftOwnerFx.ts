import { Effect } from "effect";

import type { JobCompletionContext } from "~/v1/job/completion/JobCompletionContext";
import { applyPlacementPlanFx } from "~/v1/placement/fx/applyPlacementPlanFx";
import { reviseRuntimeItemFx } from "~/v1/runtime/fx/reviseRuntimeItemFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace consumeCraftOwnerFx {
	export interface Props {
		context: JobCompletionContext<"craft">;
		replaced: boolean;
	}

	export interface Result {
		readonly remainderQuantity: number;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Consumes exactly one craft unit while preserving any remaining owner stack quantity. */
export const consumeCraftOwnerFx = Effect.fn("consumeCraftOwnerFx")(function* ({
	context,
	replaced,
}: consumeCraftOwnerFx.Props) {
	const remainderQuantity = context.owner.quantity - 1;

	if (replaced) {
		return {
			remainderQuantity,
			runtime: context.runtime,
		} satisfies consumeCraftOwnerFx.Result;
	}

	if (remainderQuantity === 0) {
		const [, runtime] = yield* applyPlacementPlanFx({
			plan: {
				remove: [
					context.owner.id,
				],
				spawn: [],
				stack: [],
			},
			runtime: context.runtime,
		});

		return {
			remainderQuantity: 0,
			runtime,
		} satisfies consumeCraftOwnerFx.Result;
	}

	const owner = yield* reviseRuntimeItemFx({
		item: {
			...context.owner,
			quantity: remainderQuantity,
		},
	});

	return {
		remainderQuantity: 0,
		runtime: {
			...context.runtime,
			items: context.runtime.items.map((item) => (item.id === owner.id ? owner : item)),
		} satisfies RuntimeSchema.Type,
	} satisfies consumeCraftOwnerFx.Result;
});
