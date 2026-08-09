import { useAtom, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useEffect, useMemo } from "react";

import {
	readEditorItemOriginFlowFx,
	type EditorItemOriginFlow,
	type EditorItemOriginFlowProgress,
	type EditorItemOriginFlowRequest,
} from "~/bridge/item/editor/readEditorItemOriginFlow";
import type {
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/editorItemOriginFlowLayout";
import { layoutEditorItemOriginFlowInWorkerFx } from "~/ui/item/editor/layoutEditorItemOriginFlowInWorkerFx";

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

interface EditorItemOriginFlowCommandRequest {
	readonly config: EditorItemOriginFlowRequest["config"];
	readonly itemId?: string;
}

interface EditorItemOriginFlowProgressState {
	readonly progress: EditorItemOriginFlowProgress;
	readonly request?: EditorItemOriginFlowCommandRequest;
}

const InitialProgress: EditorItemOriginFlowProgress = {
	label: "Preparing flow",
	percent: 0,
};

const FailedProgress: EditorItemOriginFlowProgress = {
	label: "Flow failed",
	percent: 0,
};

const EditorItemOriginFlowProgressAtom = Atom.make<EditorItemOriginFlowProgressState>({
	progress: InitialProgress,
}).pipe(Atom.setIdleTTL(0));

const EditorItemOriginFlowCommandAtom = Atom.fn(
	(request: EditorItemOriginFlowCommandRequest, get) =>
		Effect.gen(function* () {
			get.set(EditorItemOriginFlowProgressAtom, {
				progress: InitialProgress,
				request,
			});
			const flow = yield* readEditorItemOriginFlowFx({
				config: request.config,
				...(request.itemId === undefined
					? {}
					: {
							targetItemId: request.itemId,
						}),
				onProgress: (progress) => {
					get.set(EditorItemOriginFlowProgressAtom, {
						progress: {
							...progress,
							percent: Math.round(progress.percent * 0.9),
						},
						request,
					});
				},
			});
			get.set(EditorItemOriginFlowProgressAtom, {
				progress: {
					label: "Laying out flow",
					percent: 95,
				},
				request,
			});
			const layout = yield* layoutEditorItemOriginFlowInWorkerFx(flow);
			get.set(EditorItemOriginFlowProgressAtom, {
				progress: {
					label: "Flow ready",
					percent: 100,
				},
				request,
			});
			return {
				backbones: layout.backbones,
				flow,
				positions: layout.positions,
				request,
			};
		}),
).pipe(Atom.setIdleTTL(0));

/** Owns one subscription-scoped flow build for the currently routed item. */
export const useEditorItemOriginFlow = (
	config: EditorItemOriginFlowRequest["config"],
	itemId?: string,
): EditorItemOriginFlowState => {
	const request = useMemo<EditorItemOriginFlowCommandRequest>(
		() => ({
			config,
			...(itemId === undefined
				? {}
				: {
						itemId,
					}),
		}),
		[
			config,
			itemId,
		],
	);
	const [result, runFlow] = useAtom(EditorItemOriginFlowCommandAtom);
	const progressState = useAtomValue(EditorItemOriginFlowProgressAtom);

	useEffect(() => {
		runFlow(request);
	}, [
		request,
		runFlow,
	]);

	const progress = progressState.request === request ? progressState.progress : InitialProgress;
	if (AsyncResult.isSuccess(result) && !result.waiting && result.value.request === request) {
		return {
			backbones: result.value.backbones,
			flow: result.value.flow,
			positions: result.value.positions,
			progress: {
				label: "Flow ready",
				percent: 100,
			},
			status: "ready",
		};
	}
	if (AsyncResult.isFailure(result) && !result.waiting && progressState.request === request) {
		return {
			flow: undefined,
			progress: FailedProgress,
			status: "error",
		};
	}
	return {
		flow: undefined,
		progress,
		status: "loading",
	};
};
