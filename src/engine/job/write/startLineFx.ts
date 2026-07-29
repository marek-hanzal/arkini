import { Effect } from "effect";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { requestLineStartRuntimeFx } from "~/engine/job/fx/requestLineStartRuntimeFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { JobStartSourceEnumSchema } from "~/engine/event/schema/JobStartSourceEnumSchema";
export namespace startLineFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
	}
}
/**
 * Explicitly starts one already-ready idle owner.
 *
 * Queue admission is a separate command. Even under Instant gameplay, completion belongs to the
 * shared Tick boundary so independent owner commands can enter the runtime before one global
 * simulation pass resolves every runnable job.
 */
export const startLineFx = Effect.fn("startLineFx")(function* ({
	ownerItemId,
	lineId,
}: startLineFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const request = yield* requestLineStartRuntimeFx({
				ownerItemId,
				lineId,
				runtime,
				source: JobStartSourceEnumSchema.enum.Explicit,
			});
			return [
				request.start,
				request.runtime,
				request.events,
			] as const;
		}),
	);
});
