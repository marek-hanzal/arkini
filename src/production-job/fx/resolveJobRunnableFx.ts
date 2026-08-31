import { Effect } from "effect";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import { lineRulesFx } from "~/production-line/fx/lineRulesFx";
import { readBoardItemLineFx } from "~/production-line/fx/readBoardItemLineFx";
import { resolveLineEnableFn } from "~/production-line/fn/resolveLineEnableFn";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { readRuntimeItemByIdFx } from "~/game-runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { isPassiveStorageLocationFn } from "~/item-location/fn/isPassiveStorageLocationFn";
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
	const runtimeOwner = yield* readRuntimeItemByIdFx({
		itemId: job.ownerItemId,
		runtime,
	});
	if (isPassiveStorageLocationFn(runtimeOwner.location)) return false;
	const { line, owner } = yield* readBoardItemLineFx({
		lineId: job.lineId,
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
