import { Effect } from "effect";

import { reconcileOutboundDeliveriesRuntimeFx } from "~/engine/delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import { JobOwnerBusyError } from "~/engine/job/error/JobOwnerBusyError";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { discardRuntimeItemIdentityStateFx } from "~/engine/runtime/fx/discardRuntimeItemIdentityStateFx";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace removeRuntimeItemIdentityFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Removes one idle item identity and discards queued work bound to that identity. */
export const removeRuntimeItemIdentityFx = Effect.fn("removeRuntimeItemIdentityFx")(function* ({
	item,
	runtime,
}: removeRuntimeItemIdentityFx.Props) {
	const jobIds = runtime.jobs.filter((job) => job.ownerItemId === item.id).map((job) => job.id);
	if (jobIds.length > 0) {
		return yield* Effect.fail(
			new JobOwnerBusyError({
				ownerItemId: item.id,
				jobIds,
				requestIds: [],
			}),
		);
	}

	const withoutIdentityState = yield* discardRuntimeItemIdentityStateFx({
		ownerItemIds: new Set([
			item.id,
		]),
		runtime,
	});
	let removedRuntime = {
		...withoutIdentityState,
		items: withoutIdentityState.items.filter((candidate) => candidate.id !== item.id),
	} satisfies RuntimeSchema.Type;
	removedRuntime = {
		...removedRuntime,
		items: yield* Effect.forEach(removedRuntime.items, (candidate) => {
			if (
				candidate.location.scope !== LocationScopeEnumSchema.enum.Delivery ||
				candidate.location.purpose.kind !== "fill-and-try-start" ||
				candidate.location.purpose.ownerItemId !== item.id
			) {
				return Effect.succeed(candidate);
			}
			return reviseRuntimeItemFx({
				item: {
					...candidate,
					location: {
						...candidate.location,
						purpose: {
							kind: "fill" as const,
						},
					},
				},
			});
		}),
	} satisfies RuntimeSchema.Type;
	const returnFromByOwnerItemId =
		item.location.scope === LocationScopeEnumSchema.enum.Board ||
		item.location.scope === LocationScopeEnumSchema.enum.Inventory ||
		item.location.scope === LocationScopeEnumSchema.enum.Toolbar
			? new Map([
					[
						item.id,
						item.location,
					],
				])
			: undefined;
	return yield* reconcileOutboundDeliveriesRuntimeFx({
		returnFromByOwnerItemId,
		runtime: removedRuntime,
	});
});
