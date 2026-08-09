import { Effect } from "effect";
import { useEffect, useState } from "react";

import {
	readEditorItemOriginFlowFx,
	type EditorItemOriginFlow,
	type EditorItemOriginFlowProgress,
	type EditorItemOriginFlowRequest,
} from "~/bridge/item/editor/readEditorItemOriginFlow";
import { layoutEditorItemOriginFlowInWorkerFx } from "~/ui/item/editor/layoutEditorItemOriginFlowInWorkerFx";
import type {
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/editorItemOriginFlowLayout";

type EditorItemOriginFlowState =
	| {
			readonly flow: undefined;
			readonly progress: EditorItemOriginFlowProgress;
			readonly status: "loading";
	  }
	| {
			readonly backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
			readonly flow: EditorItemOriginFlow;
			readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
			readonly progress: EditorItemOriginFlowProgress;
			readonly status: "ready";
	  }
	| {
			readonly flow: undefined;
			readonly progress: EditorItemOriginFlowProgress;
			readonly status: "error";
	  };

const InitialProgress: EditorItemOriginFlowProgress = {
	label: "Preparing flow",
	percent: 0,
};

/** Owns one interruptible flow build for the currently routed item. */
export const useEditorItemOriginFlow = (
	config: EditorItemOriginFlowRequest["config"],
	itemId?: string,
): EditorItemOriginFlowState => {
	const [state, setState] = useState<EditorItemOriginFlowState>({
		flow: undefined,
		progress: InitialProgress,
		status: "loading",
	});

	useEffect(() => {
		const controller = new AbortController();
		setState({
			flow: undefined,
			progress: InitialProgress,
			status: "loading",
		});
		void Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const flow = yield* readEditorItemOriginFlowFx({
						config,
						...(itemId === undefined
							? {}
							: {
									targetItemId: itemId,
								}),
						onProgress: (progress) => {
							if (controller.signal.aborted) return;
							setState({
								flow: undefined,
								progress: {
									...progress,
									percent: Math.round(progress.percent * 0.9),
								},
								status: "loading",
							});
						},
					});
					if (!controller.signal.aborted) {
						setState({
							flow: undefined,
							progress: {
								label: "Laying out flow",
								percent: 95,
							},
							status: "loading",
						});
					}
					const layout = yield* layoutEditorItemOriginFlowInWorkerFx(flow);
					return {
						flow,
						layout,
					};
				}),
			),
			{
				signal: controller.signal,
			},
		)
			.then(({ flow, layout }) => {
				if (controller.signal.aborted) return;
				setState({
					backbones: layout.backbones,
					flow,
					positions: layout.positions,
					progress: {
						label: "Flow ready",
						percent: 100,
					},
					status: "ready",
				});
			})
			.catch((cause) => {
				if (controller.signal.aborted) return;
				console.error("Flow preparation failed.", cause);
				setState({
					flow: undefined,
					progress: {
						label: "Flow failed",
						percent: 0,
					},
					status: "error",
				});
			});

		return () => controller.abort();
	}, [
		config,
		itemId,
	]);

	return state;
};
