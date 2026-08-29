import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { assertNonJobScopeFx } from "~/engine/runtime/fx/assertNonJobScopeFx";
import { readRuntimeItemByIdFx } from "~/game-runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** Reads one exact mutable runtime root and validates its captured revision and scope. */
export const readValidatedRuntimeItemFx = Effect.fn("readValidatedRuntimeItemFx")(function* ({
	itemId,
	revision,
	runtime,
}: {
	readonly itemId: IdSchema.Type;
	readonly revision: RevisionSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const item = yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
	yield* assertRevisionFx({
		actualRevision: item.revision,
		entityId: item.id,
		expectedRevision: revision,
	});
	yield* assertNonJobScopeFx({
		item,
	});
	return item;
});
