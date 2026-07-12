import { Effect } from "effect";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
import { ItemNotOnBoardError } from "~/v1/item/error/ItemNotOnBoardError";
import { LineNotFoundError } from "~/v1/line/error/LineNotFoundError";
import { lineRulesFx } from "~/v1/line/fx/lineRulesFx";
import { readItemLineFx } from "~/v1/line/fx/readItemLineFx";
import { resolveLineEnableFx } from "~/v1/line/fx/run/resolveLineEnableFx";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
import { isBoardRuntimeItem } from "~/v1/runtime/read/isBoardRuntimeItem";
import { readRuntimeItemByIdFx } from "~/v1/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
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
	if (owner.location.scope === "inventory") return false;
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
		origin: owner.location.position,
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
