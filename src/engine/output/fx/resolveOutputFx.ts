import { Effect } from "effect";

import {
	OutputResolutionFx,
	type OutputResolutionProps,
} from "~/engine/output/context/OutputResolutionFx";

export namespace resolveOutputFx {
	export interface Props extends OutputResolutionProps {}
}

/** Resolves one authored output through the policy in the current Effect context. */
export const resolveOutputFx = Effect.fn("resolveOutputFx")(function* (
	props: resolveOutputFx.Props,
) {
	return yield* (yield* OutputResolutionFx).resolve(props);
});
