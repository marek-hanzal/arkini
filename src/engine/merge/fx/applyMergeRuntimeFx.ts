import { Effect } from "effect";

import { readOutputPlacementItemEventsFx } from "~/engine/event/read/readOutputPlacementItemEventsFx";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
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

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
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
	const targetEffect = yield* applyMergeTargetEffectFx({
		rule,
		runtime: sourceAction.runtime,
		target,
	});
	let draft = yield* returnMergeSourceFx({
		origin: target.location,
		returnDrop: sourceAction.returnDrop,
		runtime: targetEffect.runtime,
	});
	const events = [...targetEffect.events];

	if (rule.output === undefined) {
		return {
			events,
			runtime: draft,
		} satisfies applyMergeRuntimeFx.Result;
	}
	const output = yield* outputFx({
		origin: target.location,
		output: rule.output,
	});
	const [placement, withOutput] = yield* applyOutputPlacementFx({
		origin: target.location,
		output,
		runtime: draft,
	});
	events.push(...(yield* readOutputPlacementItemEventsFx(placement)));
	draft = withOutput;
	return {
		events,
		runtime: draft,
	} satisfies applyMergeRuntimeFx.Result;
});
