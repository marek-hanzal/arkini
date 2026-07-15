import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
import type { LineSchema } from "~/v1/line/schema/LineSchema";
import type { BoardRuntimeItemSchema } from "~/v1/runtime/schema/BoardRuntimeItemSchema";
import type { ReservedRuntimeItemSchema } from "~/v1/runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export type JobCompletionItem = Extract<
	ItemSchema.Type,
	{
		readonly type: "producer" | "craft" | "blueprint" | "stash";
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
