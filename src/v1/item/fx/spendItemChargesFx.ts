import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { releaseOwnerInputsFx } from "~/v1/input/fx/releaseOwnerInputsFx";
import { ItemChargesUnavailableError } from "~/v1/item/error/ItemChargesUnavailableError";
import { ItemNotOnBoardError } from "~/v1/item/error/ItemNotOnBoardError";
import { isolateStatefulOwnerFx } from "~/v1/item/fx/isolateStatefulOwnerFx";
import { readItemRemainingChargesFx } from "~/v1/item/fx/readItemRemainingChargesFx";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
import { makeChargeSpendRandomFx } from "~/v1/job/random/makeChargeSpendRandomFx";
import { outputFx } from "~/v1/output/fx/outputFx";
import { applyOutputPlacementFx } from "~/v1/placement/fx/applyOutputPlacementFx";
import { removeRuntimeItemIdentityFx } from "~/v1/runtime/fx/removeRuntimeItemIdentityFx";
import { reviseRuntimeItemFx } from "~/v1/runtime/fx/reviseRuntimeItemFx";
import { isBoardRuntimeItem } from "~/v1/runtime/read/isBoardRuntimeItem";
import { readRuntimeItemByIdFx } from "~/v1/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace spendItemChargesFx {
	export interface Props {
		cost: PositiveIntegerSchema.Type;
		itemId: IdSchema.Type;
		job: JobSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Pays one exact charge cost and atomically resolves any resulting depletion. */
export const spendItemChargesFx = Effect.fn("spendItemChargesFx")(function* ({
	cost,
	itemId,
	job,
	runtime,
}: spendItemChargesFx.Props) {
	const item = yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
	if (!isBoardRuntimeItem(item)) {
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: item.id,
				location: item.location,
			}),
		);
	}

	const remainingCharges = yield* readItemRemainingChargesFx(item);
	if (remainingCharges === undefined || remainingCharges < cost) {
		return yield* Effect.fail(
			new ItemChargesUnavailableError({
				itemId: item.id,
				cost,
				remainingCharges: remainingCharges ?? 0,
			}),
		);
	}

	const nextRemainingCharges = remainingCharges - cost;
	const activeJob = runtime.jobs.find((candidate) => candidate.ownerItemId === item.id);
	if (nextRemainingCharges > 0 || activeJob !== undefined) {
		const chargedItem = yield* reviseRuntimeItemFx({
			item: {
				...item,
				remainingCharges: nextRemainingCharges,
			} satisfies RuntimeItemSchema.Type,
		});
		const chargedRuntime = {
			...runtime,
			items: runtime.items.map((candidate) =>
				candidate.id === item.id ? chargedItem : candidate,
			),
		} satisfies RuntimeSchema.Type;

		return yield* isolateStatefulOwnerFx({
			ownerItemId: item.id,
			runtime: chargedRuntime,
		});
	}

	let draft: RuntimeSchema.Type;
	if (item.quantity > 1) {
		const remainingStack = yield* reviseRuntimeItemFx({
			item: {
				...item,
				quantity: item.quantity - 1,
			} satisfies RuntimeItemSchema.Type,
		});
		draft = {
			...runtime,
			items: runtime.items.map((candidate) =>
				candidate.id === item.id ? remainingStack : candidate,
			),
		};
	} else {
		draft = yield* removeRuntimeItemIdentityFx({
			item,
			runtime,
		});
	}

	if (item.item.charges?.output !== undefined) {
		const random = yield* makeChargeSpendRandomFx({
			cost,
			itemId: item.id,
			lineId: job.lineId,
			ownerItemId: job.ownerItemId,
			quantity: item.quantity,
			remainingCharges,
		});
		const output = yield* outputFx({
			origin: item.location.position,
			output: item.item.charges.output,
		}).pipe(Effect.withRandom(random));
		const [, withOutput] = yield* applyOutputPlacementFx({
			origin: item.location.position,
			output,
			runtime: draft,
		});
		draft = withOutput;
	}

	if (item.quantity === 1) {
		draft = yield* releaseOwnerInputsFx({
			owner: item,
			runtime: draft,
		});
	}

	return draft;
});
