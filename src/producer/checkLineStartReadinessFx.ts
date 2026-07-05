import { Effect } from "effect";
import { checkLineStartReadinessProgramFx } from "~/producer/checkLineStartReadinessProgramFx";
import type { LineStartReadinessScope } from "~/producer/LineStartReadinessTypes";

export namespace checkLineStartReadinessFx {
	export type Props = LineStartReadinessScope;
}

export const checkLineStartReadinessFx = Effect.fn("checkLineStartReadinessFx")(function* (
	props: checkLineStartReadinessFx.Props,
) {
	return yield* checkLineStartReadinessProgramFx(props);
});
