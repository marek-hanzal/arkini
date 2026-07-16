import { Effect } from "effect";

import { releaseOwnerInputsFx } from "~/engine/input/fx/releaseOwnerInputsFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { removeRuntimeItemIdentityFx } from "./removeRuntimeItemIdentityFx";

export namespace removeRuntimeItemFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Removes one item, releases its buffered inputs, and discards its queued identity-bound work. */
export const removeRuntimeItemFx = Effect.fn("removeRuntimeItemFx")(function* ({
	item,
	runtime,
}: removeRuntimeItemFx.Props) {
	const releasedRuntime = yield* releaseOwnerInputsFx({
		owner: item,
		runtime,
	});

	return yield* removeRuntimeItemIdentityFx({
		item,
		runtime: releasedRuntime,
	});
});
