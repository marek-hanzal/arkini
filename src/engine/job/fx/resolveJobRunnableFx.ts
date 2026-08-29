import { Effect } from "effect";
import type { JobSchema } from "~/engine/job/schema/JobSchema";
import { lineRulesFx } from "~/engine/line/fx/lineRulesFx";
import { readBoardItemLineFx } from "~/engine/line/fx/readBoardItemLineFx";
import { resolveLineEnableFn } from "~/engine/line/fn/resolveLineEnableFn";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { isPassiveStorageLocationFn } from "~/engine/location/fn/isPassiveStorageLocationFn";
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
