import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
import type { LineSchema } from "~/v1/line/schema/LineSchema";
import type { BoardRuntimeItemSchema } from "~/v1/runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export type JobCompletionItem = Extract<
	ItemSchema.Type,
	{
		readonly afterCompletion: "keep" | "remove";
	}
>;

export type JobCompletionOwner = Omit<BoardRuntimeItemSchema.Type, "item"> & {
	readonly item: JobCompletionItem;
};

/**
 * Shared live facts resolved once before completing one line job.
 *
 * `runtime` already excludes the completed job and every job-scoped reservation. The
 * line output keeps its authored placement and the owner item declares whether its
 * identity survives completion.
 */
export interface JobCompletionContext {
	readonly job: JobSchema.Type;
	readonly line: LineSchema.Type;
	readonly owner: JobCompletionOwner;
	readonly reservations: readonly RuntimeItemSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}
