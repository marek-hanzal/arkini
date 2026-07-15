import { Effect } from "effect";

import type { MergeSchema } from "~/v1/merge/schema/MergeSchema";
import { outputFx } from "~/v1/output/fx/outputFx";
import { applyOutputPlacementFx } from "~/v1/placement/fx/applyOutputPlacementFx";
import type { BoardRuntimeItemSchema } from "~/v1/runtime/schema/BoardRuntimeItemSchema";
import type { GridRuntimeItemSchema } from "~/v1/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { applyMergeSourceActionFx } from "./applyMergeSourceActionFx";
import { applyMergeTargetEffectFx } from "./applyMergeTargetEffectFx";
import { returnMergeSourceFx } from "./returnMergeSourceFx";

export namespace applyMergeRuntimeFx {
	export interface Props {
		rule: MergeSchema.Type;
		runtime: RuntimeSchema.Type;
		source: GridRuntimeItemSchema.Type;
		target: BoardRuntimeItemSchema.Type;
	}
}

/** Applies one resolved directional merge to an immutable candidate runtime. */
export const applyMergeRuntimeFx = Effect.fn("applyMergeRuntimeFx")(function* ({
	rule,
	runtime,
	source,
	target,
}: applyMergeRuntimeFx.Props) {
	const sourceAction = yield* applyMergeSourceActionFx({
		action: rule.action,
		runtime,
		source,
	});
	let draft = yield* applyMergeTargetEffectFx({
		rule,
		runtime: sourceAction.runtime,
		target,
	});
	draft = yield* returnMergeSourceFx({
		origin: target.location.position,
		returnDrop: sourceAction.returnDrop,
		runtime: draft,
	});

	if (rule.output === undefined) return draft;
	const output = yield* outputFx({
		origin: target.location.position,
		output: rule.output,
	});
	const [, withOutput] = yield* applyOutputPlacementFx({
		origin: target.location.position,
		output,
		runtime: draft,
	});
	return withOutput;
});
