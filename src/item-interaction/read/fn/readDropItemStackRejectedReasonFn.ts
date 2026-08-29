import { match, P } from "ts-pattern";

import { StackItemsUnavailableError } from "~/item-interaction/error/StackItemsUnavailableError";
import { DropItemRejectedReason } from "~/item-interaction/DropItemResult";

export namespace readDropItemStackRejectedReasonFn {
	export interface Props {
		readonly reason: StackItemsUnavailableError.Reason;
	}
}

/** Maps one exact stack-resolution failure into the public drop rejection vocabulary. */
export const readDropItemStackRejectedReasonFn = ({
	reason,
}: readDropItemStackRejectedReasonFn.Props) =>
	match(reason)
		.with(
			P.union(
				StackItemsUnavailableError.Reason.SourceNotFound,
				StackItemsUnavailableError.Reason.StaleSourceLocation,
				StackItemsUnavailableError.Reason.StaleSourceRevision,
			),
			() => DropItemRejectedReason.StaleSource,
		)
		.with(
			P.union(
				StackItemsUnavailableError.Reason.TargetNotFound,
				StackItemsUnavailableError.Reason.StaleTargetLocation,
				StackItemsUnavailableError.Reason.StaleTargetRevision,
			),
			() => DropItemRejectedReason.StaleTarget,
		)
		.with(
			StackItemsUnavailableError.Reason.SourceNotOnGrid,
			() => DropItemRejectedReason.InvalidSource,
		)
		.with(
			P.union(
				StackItemsUnavailableError.Reason.CrossSpace,
				StackItemsUnavailableError.Reason.DifferentCanonicalItem,
				StackItemsUnavailableError.Reason.SameItem,
				StackItemsUnavailableError.Reason.SourceStateful,
				StackItemsUnavailableError.Reason.TargetNotOnGrid,
				StackItemsUnavailableError.Reason.TargetStateful,
			),
			() => DropItemRejectedReason.InvalidTarget,
		)
		.with(StackItemsUnavailableError.Reason.TargetFull, () => DropItemRejectedReason.Occupied)
		.exhaustive();
