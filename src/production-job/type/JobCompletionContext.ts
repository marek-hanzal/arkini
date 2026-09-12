import type { JobSchema } from "~/production-job/schema/JobSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";
import type { ReservedRuntimeItemSchema } from "~/game-runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/**
 * Shared live facts resolved once before completing one line job.
 *
 * `runtime` already excludes the completed job and consumed job material, while reserved items remain live until identity-aware placement returns them.
 * Item lifetime is determined only by its live unit state.
 */
export interface JobCompletionContext {
	readonly job: JobSchema.Type;
	readonly line: LineSchema.Type;
	readonly owner: BoardRuntimeItemSchema.Type;
	readonly reservations: readonly ReservedRuntimeItemSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}
