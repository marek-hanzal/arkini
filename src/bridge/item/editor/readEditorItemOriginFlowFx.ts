import { Effect } from "effect";

import type { EditorItemOriginFlowProgress } from "~/bridge/item/editor/EditorItemOriginFlow";
import { indexEditorItemOriginSourcesFx } from "~/bridge/item/editor/indexEditorItemOriginSourcesFx";
import { materializeEditorItemOriginFlowFx } from "~/bridge/item/editor/materializeEditorItemOriginFlowFx";
import { readEditorItemOriginIncomeSubgraphFx } from "~/bridge/item/editor/readEditorItemOriginIncomeSubgraphFx";
import { reportEditorItemOriginFlowProgressFx } from "~/bridge/item/editor/reportEditorItemOriginFlowProgressFx";
import { resolveEditorItemOriginReachabilityFx } from "~/bridge/item/editor/resolveEditorItemOriginReachabilityFx";
import { yieldEditorItemOriginFlowFx } from "~/bridge/item/editor/yieldEditorItemOriginFlowFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export * from "~/bridge/item/editor/EditorItemOriginFlow";

export interface EditorItemOriginFlowRequest {
	readonly config: GameConfigSchema.Type;
	readonly onProgress?: (progress: EditorItemOriginFlowProgress) => void;
	/** When omitted, the complete game graph is returned. Item mode keeps one Income proof. */
	readonly targetItemId?: string;
}

/** Builds the editor item graph cooperatively. Operations stay embedded in their owning item node. */
export const readEditorItemOriginFlowFx = Effect.fn("readEditorItemOriginFlowFx")(function* ({
	config,
	onProgress,
	targetItemId,
}: EditorItemOriginFlowRequest) {
	const index = yield* indexEditorItemOriginSourcesFx({
		config,
		onProgress,
	});
	const acquisitionSourceByItem = yield* resolveEditorItemOriginReachabilityFx({
		onProgress,
		sources: index.sources,
		starters: index.starters,
	});
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "tracing", 80);
	const originSubgraph =
		targetItemId === undefined
			? undefined
			: yield* readEditorItemOriginIncomeSubgraphFx({
					acquisitionSourceByItem,
					sourcesById: index.sourcesById,
					sourcesByOutput: index.sourcesByOutput,
					starters: index.starters,
					targetItemId,
				});
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "finalizing", 92);
	yield* yieldEditorItemOriginFlowFx();
	const flow = yield* materializeEditorItemOriginFlowFx({
		acquisitionSourceByItem,
		index,
		originSubgraph,
	});
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "finalizing", 100);
	return flow;
});
