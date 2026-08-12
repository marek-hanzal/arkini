import { Effect } from "effect";

import { OutputResolutionFx } from "~/engine/output/context/OutputResolutionFx";
import type { outputFx } from "~/engine/output/fx/outputFx";

export namespace resolveOutputFx {
	export interface Props extends outputFx.Props {}
}

/** Resolves one authored output through the policy in the current Effect context. */
export const resolveOutputFx = Effect.fn("resolveOutputFx")(function* (
	props: resolveOutputFx.Props,
) {
	return yield* (yield* OutputResolutionFx).resolve(props);
});
