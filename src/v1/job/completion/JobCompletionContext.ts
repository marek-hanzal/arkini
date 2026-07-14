import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
import type { LineSchema } from "~/v1/line/schema/LineSchema";
import type { BoardRuntimeItemSchema } from "~/v1/runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export type JobCompletionOwner<ItemType extends ItemSchema.Type["type"]> = Omit<
	BoardRuntimeItemSchema.Type,
	"item"
> & {
	readonly item: Extract<
		ItemSchema.Type,
		{
			type: ItemType;
		}
	>;
};

/**
 * Shared live facts resolved once before dispatching one owner-specific completion branch.
 *
 * `runtime` already excludes the completed job and every job-scoped reservation. Each
 * branch owns the order in which it places output, consumes or replaces its owner, and
 * returns those detached reservations through the standard drop-placement path.
 */
export interface JobCompletionContext<ItemType extends ItemSchema.Type["type"]> {
	readonly job: JobSchema.Type;
	readonly line: LineSchema.Type;
	readonly owner: JobCompletionOwner<ItemType>;
	readonly reservations: readonly RuntimeItemSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}
