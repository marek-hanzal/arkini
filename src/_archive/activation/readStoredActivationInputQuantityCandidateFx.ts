import { Effect } from "effect";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import { readAcceptedTransferQuantity } from "~/quantity/readAcceptedTransferQuantity";

export type StoredActivationInputQuantityCandidate = {
	nextQuantity: number;
	previousQuantity: number;
	resolvedRef: GameActionResolvedInputRef;
};

export namespace readStoredActivationInputQuantityCandidateFx {
	export interface Props {
		capacity: number;
		previousQuantity: number;
		resolvedRef: GameActionResolvedInputRef;
	}
}

export const readStoredActivationInputQuantityCandidateFx = Effect.fn(
	"readStoredActivationInputQuantityCandidateFx",
)(function* ({
	capacity,
	previousQuantity,
	resolvedRef,
}: readStoredActivationInputQuantityCandidateFx.Props) {
	const acceptedQuantity = readAcceptedTransferQuantity({
		availableQuantity: resolvedRef.quantity,
		remainingCapacity: capacity - previousQuantity,
	});
	if (acceptedQuantity <= 0) return undefined;

	return {
		nextQuantity: previousQuantity + acceptedQuantity,
		previousQuantity,
		resolvedRef: {
			...resolvedRef,
			quantity: acceptedQuantity,
		},
	} satisfies StoredActivationInputQuantityCandidate;
});
