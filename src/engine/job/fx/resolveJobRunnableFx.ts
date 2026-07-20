import { Effect } from "effect";
import type { JobSchema } from "~/engine/job/schema/JobSchema";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { LineNotFoundError } from "~/engine/line/error/LineNotFoundError";
import { lineRulesFx } from "~/engine/line/fx/lineRulesFx";
import { readItemLineFx } from "~/engine/line/fx/readItemLineFx";
import { resolveLineEnableFx } from "~/engine/line/fx/run/resolveLineEnableFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { isBoardRuntimeItem } from "~/engine/runtime/read/isBoardRuntimeItem";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { isPassiveStorageLocation } from "~/engine/location/read/isPassiveStorageLocation";
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
	const owner = yield* readRuntimeItemByIdFx({
		itemId: job.ownerItemId,
		runtime,
	});
	if (isPassiveStorageLocation(owner.location)) return false;
	if (!isBoardRuntimeItem(owner))
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: owner.id,
				location: owner.location,
			}),
		);
	const line = yield* readItemLineFx({
		item: owner.item,
		lineId: job.lineId,
	});
	if (line === undefined)
		return yield* Effect.fail(
			new LineNotFoundError({
				itemId: owner.id,
				lineId: job.lineId,
			}),
		);
	const rules = yield* lineRulesFx({
		origin: owner.location,
		rules: line.rules,
	}).pipe(
		Effect.provideService(RuntimeFx, {
			read: Effect.succeed(runtime),
		}),
	);
	return yield* resolveLineEnableFx({
		line,
		rules,
	});
});
