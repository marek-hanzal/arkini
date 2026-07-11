import { Effect } from "effect";

import type { DropSchema } from "~/v1/output/schema/DropSchema";
import type { DropResultSchema } from "~/v1/output/schema/DropResultSchema";
import { rollQuantityFx } from "~/v1/quantity/fx/rollQuantityFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import { dropRuleFx } from "./dropRuleFx";

export namespace dropFx {
	export interface Props {
		drop: DropSchema.Type;
		origin: RuntimeItemSchema.Type;
	}
}

/**
 * Resolves one selected drop into zero or one concrete item drops.
 *
 * Availability rules run before quantity resolution. A rejected drop is
 * discarded without consuming quantity randomness, rerolling, or selecting a
 * replacement candidate.
 */
export const dropFx = Effect.fn("dropFx")(function* ({ drop, origin }: dropFx.Props) {
	const enabled = yield* Effect.every(drop.rules, (rule) => {
		return dropRuleFx({
			origin,
			rule,
		});
	});
	if (!enabled) {
		return [];
	}

	const quantity = yield* rollQuantityFx({
		quantity: drop.quantity,
	});

	return [
		{
			itemId: drop.itemId,
			placement: drop.placement,
			quantity,
		},
	] satisfies DropResultSchema.Type[];
});
