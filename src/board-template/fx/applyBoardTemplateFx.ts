import { Effect } from "effect";
import { applyBoardTemplateRuntimeFx } from "~/board-template/fx/applyBoardTemplateRuntimeFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import type { IdSchema } from "~/game-value/schema/IdSchema";

/** Replaces the currently viewed board in one serialized commit. */
export const applyBoardTemplateFx = Effect.fn("applyBoardTemplateFx")(function* ({
	templateUid,
}: {
	readonly templateUid: IdSchema.Type;
}) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const result = yield* applyBoardTemplateRuntimeFx({
				runtime,
				space: runtime.currentSpace,
				templateUid,
			});
			return [
				result.runtime,
				result.runtime,
				[
					{
						type: "template:applied",
						effect: {
							type: "template",
							space: runtime.currentSpace,
							templateUid,
							removed: result.removed,
						},
					},
				] as const,
			] as const;
		}),
	);
});
