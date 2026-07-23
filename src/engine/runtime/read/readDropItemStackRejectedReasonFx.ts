import { Effect } from "effect";
import { match, P } from "ts-pattern";

import { StackItemsUnavailableError } from "~/engine/runtime/error/StackItemsUnavailableError";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";

export namespace readDropItemStackRejectedReasonFx {
	export interface Props {
		readonly reason: StackItemsUnavailableError.Reason;
	}
}

/** Maps one exact stack-resolution failure into the public drop rejection vocabulary. */
export const readDropItemStackRejectedReasonFx = Effect.fn("readDropItemStackRejectedReasonFx")(
	function* ({ reason }: readDropItemStackRejectedReasonFx.Props) {
		return match(reason)
			.with(
				P.union(
					StackItemsUnavailableError.Reason.SourceNotFound,
					StackItemsUnavailableError.Reason.StaleSourceLocation,
					StackItemsUnavailableError.Reason.StaleSourceRevision,
				),
				() => DropItemRejectedReasonEnumSchema.enum.StaleSource,
			)
			.with(
				P.union(
					StackItemsUnavailableError.Reason.TargetNotFound,
					StackItemsUnavailableError.Reason.StaleTargetLocation,
					StackItemsUnavailableError.Reason.StaleTargetRevision,
				),
				() => DropItemRejectedReasonEnumSchema.enum.StaleTarget,
			)
			.with(
				StackItemsUnavailableError.Reason.SourceNotOnGrid,
				() => DropItemRejectedReasonEnumSchema.enum.InvalidSource,
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
				() => DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
			)
			.with(
				StackItemsUnavailableError.Reason.TargetFull,
				() => DropItemRejectedReasonEnumSchema.enum.Occupied,
			)
			.exhaustive();
	},
);
