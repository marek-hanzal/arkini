import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { JobSchema } from "~/engine/job/schema/JobSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
import type { ReservedRuntimeItemSchema } from "~/engine/runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export type JobCompletionItem = Extract<
	ItemSchema.Type,
	{
		readonly type:
			| typeof ItemEnumSchema.enum.Blueprint
			| typeof ItemEnumSchema.enum.Craft
			| typeof ItemEnumSchema.enum.Producer
			| typeof ItemEnumSchema.enum.Stash;
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
