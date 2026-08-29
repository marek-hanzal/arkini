import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
import type { ReservedRuntimeItemSchema } from "~/engine/runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

type JobCompletionItem = Extract<
	ItemSchema.Type,
	{
		readonly type:
			| typeof TypeSchema.enum.Blueprint
			| typeof TypeSchema.enum.Craft
			| typeof TypeSchema.enum.Deposit
			| typeof TypeSchema.enum.Producer
			| typeof TypeSchema.enum.Stash;
	}
>;

export type JobCompletionOwner = Omit<BoardRuntimeItemSchema.Type, "item"> & {
	readonly item: JobCompletionItem;
};

/**
 * Shared live facts resolved once before completing one line job.
 *
 * `runtime` already excludes the completed job and consumed job material, while reserved items remain live until identity-aware placement returns them.
 * Item lifetime is determined only by its live charge state.
 */
export interface JobCompletionContext {
	readonly job: JobSchema.Type;
	readonly line: LineSchema.Type;
	readonly owner: JobCompletionOwner;
	readonly reservations: readonly ReservedRuntimeItemSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}
