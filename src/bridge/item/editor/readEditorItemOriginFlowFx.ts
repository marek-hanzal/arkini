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
import { createEditorEstimatePolicyFx } from "~/editor/estimator/createEditorEstimatePolicyFx";
import { estimateEditorItemFx } from "~/editor/estimator/estimateEditorItemFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export interface EditorItemOriginFlowRequest {
	readonly config: GameConfigSchema.Type;
	readonly onProgress?: (progress: EditorItemOriginFlowProgress) => void;
	/** When omitted, the complete game graph is returned. Item mode keeps one Income proof. */
	readonly targetItemId?: string;
}

const readAcquisitionSourceByItemFx = Effect.fn(
	"readEditorItemOriginFlowFx.readAcquisitionSourceByItemFx",
)(function* ({
	index,
	targetItemId,
}: {
	readonly index: EditorItemOriginSourceIndex;
	readonly targetItemId?: string;
}) {
	if (targetItemId === undefined) {
		const policy = yield* createEditorEstimatePolicyFx(index.graph);
		return {
			acquisitionSourceByItem: new Map(
				[
					...policy.preferredRouteIdByFact,
				].map(([factId, routeId]) => [
					factId,
					index.sourcesById.get(routeId)?.id ?? routeId,
				]),
			),
			selectedRequirementFactIdsBySourceId: undefined,
		};
	}
	const estimate = yield* estimateEditorItemFx({
		factId: targetItemId,
		graph: index.graph,
	});
	if (!estimate.obtainable)
		return {
			acquisitionSourceByItem: new Map<string, string>(),
			selectedRequirementFactIdsBySourceId: undefined,
		};
	const routeSteps = estimate.routeSteps.filter((step) => step.source === "route");
	const selectedRequirementFactIdsBySourceId = new Map<string, string[]>();
	for (const step of routeSteps) {
		const sourceId = index.sourcesById.get(step.routeId)?.id ?? step.routeId;
		const requirements = selectedRequirementFactIdsBySourceId.get(sourceId) ?? [];
		selectedRequirementFactIdsBySourceId.set(sourceId, [
			...new Set([
				...requirements,
				...step.requirements.map(({ factId }) => factId),
			]),
		]);
	}
	return {
		acquisitionSourceByItem: new Map(
			routeSteps.map((step) => [
				step.factId,
				index.sourcesById.get(step.routeId)?.id ?? step.routeId,
			]),
		),
		selectedRequirementFactIdsBySourceId,
	};
});

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
	const { acquisitionSourceByItem, selectedRequirementFactIdsBySourceId } =
		yield* readAcquisitionSourceByItemFx({
			index,
			targetItemId,
		});
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "resolving", 74);
	yield* yieldEditorItemOriginFlowFx();
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "tracing", 80);
	const originSubgraph =
		targetItemId === undefined
			? undefined
			: yield* readEditorItemOriginIncomeSubgraphFx({
					acquisitionSourceByItem,
					selectedRequirementFactIdsBySourceId,
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
