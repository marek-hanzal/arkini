import { Effect } from "effect";

import type { MergeSchema } from "~/engine/merge/schema/MergeSchema";
import { outputFx } from "~/engine/output/fx/outputFx";
import { applyOutputPlacementFx } from "~/engine/placement/fx/applyOutputPlacementFx";
import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
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
		origin: target.location,
		returnDrop: sourceAction.returnDrop,
		runtime: draft,
	});

	if (rule.output === undefined) return draft;
	const output = yield* outputFx({
		origin: target.location,
		output: rule.output,
	});
	const [, withOutput] = yield* applyOutputPlacementFx({
		origin: target.location,
		output,
		runtime: draft,
	});
	return withOutput;
});
