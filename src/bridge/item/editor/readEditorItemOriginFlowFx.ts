import { Effect } from "effect";

import type { EditorItemOriginFlowProgress } from "~/bridge/item/editor/EditorItemOriginFlow";
import {
	type EditorItemOriginSourceIndex,
	indexEditorItemOriginSourcesFx,
} from "~/bridge/item/editor/indexEditorItemOriginSourcesFx";
import { materializeEditorItemOriginFlowFx } from "~/bridge/item/editor/materializeEditorItemOriginFlowFx";
import { readEditorItemOriginIncomeSubgraphFx } from "~/bridge/item/editor/readEditorItemOriginIncomeSubgraphFx";
import { reportEditorItemOriginFlowProgressFx } from "~/bridge/item/editor/reportEditorItemOriginFlowProgressFx";
import { yieldEditorItemOriginFlowFx } from "~/bridge/item/editor/yieldEditorItemOriginFlowFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export interface EditorItemOriginFlowRequest {
	readonly config: GameConfigSchema.Type;
	readonly onProgress?: (progress: EditorItemOriginFlowProgress) => void;
	/** When omitted, the complete game graph is returned. Item mode traces one raw Income source tree. */
	readonly targetItemId?: string;
}

const readAcquisitionSourceByItem = (index: EditorItemOriginSourceIndex) =>
	new Map(
		[
			...index.sourcesByOutput,
		].flatMap(([itemId, sources]) => {
			const source = [
				...sources,
			].sort((left, right) => left.id.localeCompare(right.id))[0];
			return source === undefined
				? []
				: [
						[
							itemId,
							source.id,
						] as const,
					];
		}),
	);

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
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "resolving", 44);
	const acquisitionSourceByItem = readAcquisitionSourceByItem(index);
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "resolving", 74);
	yield* yieldEditorItemOriginFlowFx();
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
