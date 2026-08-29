import { Effect } from "effect";

import type { EditorItemOriginFlowProgress } from "~/flow/domain/EditorItemOriginFlow";
import {
	type EditorItemOriginSourceIndex,
	indexEditorItemOriginSourcesFx,
} from "~/flow/domain/fx/indexEditorItemOriginSourcesFx";
import { reportEditorItemOriginFlowProgressFx } from "~/flow/domain/fx/reportEditorItemOriginFlowProgressFx";
import { yieldEditorItemOriginFlowFx } from "~/flow/domain/fx/yieldEditorItemOriginFlowFx";
import { materializeEditorItemOriginFlowFn } from "~/flow/domain/fn/materializeEditorItemOriginFlowFn";
import type { GameConfigSchema } from "~/game-config/GameConfigSchema";

export interface EditorItemOriginFlowRequest {
	readonly config: GameConfigSchema.Type;
	readonly onProgress?: (progress: EditorItemOriginFlowProgress) => void;
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
}: EditorItemOriginFlowRequest) {
	const index = yield* indexEditorItemOriginSourcesFx({
		config,
		onProgress,
	});
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "resolving", 44);
	const acquisitionSourceByItem = readAcquisitionSourceByItem(index);
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "resolving", 74);
	yield* yieldEditorItemOriginFlowFx();
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "finalizing", 92);
	yield* yieldEditorItemOriginFlowFx();
	const flow = materializeEditorItemOriginFlowFn({
		acquisitionSourceByItem,
		index,
	});
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "finalizing", 100);
	return flow;
});
