import { Effect } from "effect";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import { lineRulesFx } from "~/production-line/fx/lineRulesFx";
import { readBoardItemLineFx } from "~/production-line/fx/readBoardItemLineFx";
import { resolveLineEnableFn } from "~/production-line/fn/resolveLineEnableFn";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
export namespace resolveJobRunnableFx {
	export interface Props {
		job: JobSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}
/** Resolves only live rules that may pause an already-started job. */
export const resolveJobRunnableFx = Effect.fn("resolveJobRunnableFx")(function* ({
	job,
	runtime,
}: resolveJobRunnableFx.Props) {
	const hasReadyMaterial = runtime.items.some(
		(item) =>
			item.schedule?.remainingDurationMs === 0 &&
			(item.location.scope === LocationScopeEnumSchema.enum.Job ||
				item.location.scope === LocationScopeEnumSchema.enum.Reserved) &&
			item.location.jobId === job.id,
	);
	if (hasReadyMaterial) return false;
	// An admitted job keeps running after its depleted owner leaves the Board.
	// Its line was already validated at start; the detached owner has no live grid rules.
	if (
		runtime.items.some(
			(item) =>
				item.id === job.ownerItemId &&
				item.location.scope === LocationScopeEnumSchema.enum.Terminal,
		)
	)
		return true;

	const { line, owner } = yield* readBoardItemLineFx({
		lineUid: job.lineUid,
		ownerItemId: job.ownerItemId,
		runtime,
	});
	const rules = yield* lineRulesFx({
		origin: owner.location,
		rules: line.rules,
	}).pipe(
		Effect.provideService(RuntimeFx, {
			read: Effect.succeed(runtime),
		}),
	);
	return resolveLineEnableFn({
		line,
		rules,
	});
});
