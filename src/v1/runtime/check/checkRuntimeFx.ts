import { Effect } from "effect";

import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import type { RuntimeCheckResultSchema } from "~/v1/runtime/schema/check/RuntimeCheckResultSchema";
import { checkRuntimeItemIdsFx } from "./checkRuntimeItemIdsFx";
import { checkRuntimeLocationsFx } from "./checkRuntimeLocationsFx";

export namespace checkRuntimeFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Runs every explicit invariant checker against one candidate runtime.
 */
export const checkRuntimeFx = Effect.fn("checkRuntimeFx")(function* ({
	runtime,
}: checkRuntimeFx.Props) {
	const config = yield* GameConfigFx;
	const itemIdIssues = yield* checkRuntimeItemIdsFx({
		runtime,
	});
	const locationIssues = yield* checkRuntimeLocationsFx({
		config,
		runtime,
	});

	return {
		issues: [
			...itemIdIssues,
			...locationIssues,
		],
	} satisfies RuntimeCheckResultSchema.Type;
});
