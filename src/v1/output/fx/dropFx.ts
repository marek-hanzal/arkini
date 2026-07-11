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
	for (const rule of drop.rules) {
		const enabled = yield* dropRuleFx({
			origin,
			rule,
		});
		if (!enabled) {
			return [] satisfies DropResultSchema.Type[];
		}
	}

	const quantity = yield* rollQuantityFx({
		quantity: drop.quantity,
	});
	const result = {
		itemId: drop.itemId,
		placement: drop.placement,
		quantity,
	} satisfies DropResultSchema.Type;

	return [
		result,
	] satisfies DropResultSchema.Type[];
});
