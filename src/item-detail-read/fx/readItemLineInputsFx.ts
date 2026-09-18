import { Effect } from "effect";

import { matchesItemSelectorFn } from "~/item-definition/fn/matchesItemSelectorFn";
import { readLineInputAutofillSourcesFn } from "~/production-input/fn/readLineInputAutofillSourcesFn";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { readLineInputDeliveryClaimsFn } from "~/production-delivery/fn/readLineInputDeliveryClaimsFn";
import { planLineInputAutofillFx } from "~/production-input/fx/planLineInputAutofillFx";
import type { MaterialSchema } from "~/production-input/schema/MaterialSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";

export namespace readItemLineInputsFx {
	export interface Props {
		readonly ownerItemId?: IdSchema.Type;
		readonly line: LineSchema.Type;
		readonly runtime: RuntimeSchema.Type;
		readonly work?: {
			readonly kind: "active" | "queued";
			readonly id: IdSchema.Type;
		};
	}

	export interface Input {
		readonly inputIndex: number;
		readonly itemId: IdSchema.Type;
		readonly quantity: MaterialSchema.Type["quantity"];
		readonly filled: number;
		readonly available: boolean;
		/** Obtainable stock plus this slot's incoming deliveries, excluding already filled material. */
		readonly availableQuantity: number;
		readonly committed: boolean;
	}
}

/** Keeps local fill separate from obtainable material and attributes active roots to their exact job slot. */
export const readItemLineInputsFx = Effect.fn("readItemLineInputsFx")(function* ({
	ownerItemId,
	line,
	runtime,
	work,
}: readItemLineInputsFx.Props) {
	const owner = runtime.items.find((item) => item.id === ownerItemId);
	const liveLine = owner?.item.lines.find((candidate) => candidate.id === line.id);
	const plan =
		work === undefined && owner?.location.scope === "board" && liveLine !== undefined
			? yield* planLineInputAutofillFx({
					ownerItemId: owner.id,
					lineId: line.id,
					runtime,
				})
			: undefined;
	const sources =
		owner?.location.scope === "board"
			? readLineInputAutofillSourcesFn({
					owner: {
						...owner,
						location: owner.location,
					},
					runtime,
				})
			: [];
	const job = runtime.jobs.find(
		(candidate) =>
			candidate.ownerItemId === ownerItemId &&
			candidate.lineId === line.id &&
			(work === undefined || (work.kind === "active" && candidate.id === work.id)),
	);
	// Line buffers serve the earliest pending request, not every duplicate or its active predecessor.
	const ownsBuffer =
		work === undefined ||
		(work.kind === "queued" &&
			runtime.jobQueue.find(
				(request) => request.ownerItemId === ownerItemId && request.lineId === line.id,
			)?.id === work.id);
	const inputs: readItemLineInputsFx.Input[] = [];
	for (const [inputIndex, input] of (liveLine ?? line).input.entries()) {
		if (input.type !== "materials") continue;
		let filled = 0;
		let committed = false;
		for (const item of runtime.items) {
			const location = item.location;
			if (
				ownsBuffer &&
				location.scope === "input" &&
				location.ownerItemId === ownerItemId &&
				location.lineId === line.id &&
				location.inputIndex === inputIndex
			) {
				filled += item.quantity;
			} else if (
				(location.scope === "job" || location.scope === "reserved") &&
				job !== undefined &&
				location.jobId === job.id &&
				location.inputIndex === inputIndex
			) {
				filled += item.quantity;
				committed = true;
			}
		}
		const incoming =
			ownerItemId === undefined || !ownsBuffer
				? []
				: readLineInputDeliveryClaimsFn({
						ownerItemId,
						lineId: line.id,
						inputIndex,
						runtime,
					});
		const availableQuantity =
			sources.reduce(
				(total, source) =>
					total +
					(matchesItemSelectorFn({
						item: source.item,
						selector: input.selector,
					})
						? source.quantity
						: 0),
				0,
			) + incoming.reduce((total, claim) => total + claim.quantity, 0);
		inputs.push({
			inputIndex,
			itemId: input.selector.itemId,
			quantity: input.quantity,
			filled,
			committed,
			availableQuantity,
			available:
				work === undefined
					? incoming.length > 0 ||
						(plan?.entry.some((entry) => entry.inputIndex === inputIndex) ?? false)
					: availableQuantity > 0,
		});
	}
	return inputs;
});
