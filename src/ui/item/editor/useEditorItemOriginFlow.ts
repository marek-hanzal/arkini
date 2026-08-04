import { Effect } from "effect";
import { useEffect, useState } from "react";

import {
	readEditorItemOriginFlowFx,
	type EditorItemOriginFlow,
	type EditorItemOriginFlowProgress,
	type EditorItemOriginFlowRequest,
} from "~/bridge/item/editor/readEditorItemOriginFlow";

type EditorItemOriginFlowState =
	| {
			readonly flow: undefined;
			readonly progress: EditorItemOriginFlowProgress;
			readonly status: "loading";
	  }
	| {
			readonly flow: EditorItemOriginFlow;
			readonly progress: EditorItemOriginFlowProgress;
			readonly status: "ready";
	  }
	| {
			readonly flow: undefined;
			readonly progress: EditorItemOriginFlowProgress;
			readonly status: "error";
	  };

const InitialProgress: EditorItemOriginFlowProgress = {
	label: "Preparing acquisition graph",
	percent: 0,
	phase: "indexing",
};

/** Owns one interruptible acquisition-flow build for the currently routed item. */
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
			readEditorItemOriginFlowFx({
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
						progress,
						status: "loading",
					});
				},
			}),
			{
				signal: controller.signal,
			},
		)
			.then((flow) => {
				if (controller.signal.aborted) return;
				setState({
					flow,
					progress: {
						label: "Acquisition graph ready",
						percent: 100,
						phase: "finalizing",
					},
					status: "ready",
				});
			})
			.catch((cause) => {
				if (controller.signal.aborted) return;
				console.error("Acquisition graph build failed.", cause);
				setState({
					flow: undefined,
					progress: {
						label: "Acquisition graph could not be built",
						percent: 0,
						phase: "finalizing",
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
