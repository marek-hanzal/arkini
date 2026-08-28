import { useAtom, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useEffect, useMemo } from "react";

import {
	type EditorItemOriginFlow,
	type EditorItemOriginFlowProgress,
} from "~/bridge/item/editor/EditorItemOriginFlow";
import {
	readEditorItemOriginFlowFx,
	type EditorItemOriginFlowRequest,
} from "~/bridge/item/editor/readEditorItemOriginFlowFx";
import type { LayoutNode, LayoutPoint } from "~/ui/item/editor/origin-flow/Layout";
import { layoutInWorkerFx } from "~/ui/item/editor/origin-flow/layoutInWorkerFx";

type State =
	| {
			readonly flow: undefined;
			readonly progress: EditorItemOriginFlowProgress;
			readonly status: "loading";
	  }
	| {
			readonly backbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
			readonly flow: EditorItemOriginFlow;
			readonly positions: ReadonlyMap<string, LayoutNode>;
			readonly progress: EditorItemOriginFlowProgress;
			readonly status: "ready";
	  }
	| {
			readonly flow: undefined;
			readonly progress: EditorItemOriginFlowProgress;
			readonly status: "error";
	  };

interface CommandRequest {
	readonly config: EditorItemOriginFlowRequest["config"];
}

interface ProgressState {
	readonly progress: EditorItemOriginFlowProgress;
	readonly request?: CommandRequest;
}

const InitialProgress: EditorItemOriginFlowProgress = {
	label: "Preparing flow",
	percent: 0,
};

const FailedProgress: EditorItemOriginFlowProgress = {
	label: "Flow failed",
	percent: 0,
};

const createAtoms = () => {
	const progressAtom = Atom.make<ProgressState>({
		progress: InitialProgress,
	}).pipe(Atom.setIdleTTL(0));
	const commandAtom = Atom.fn((request: CommandRequest, get) =>
		Effect.gen(function* () {
			get.set(progressAtom, {
				progress: InitialProgress,
				request,
			});
			const flow = yield* readEditorItemOriginFlowFx({
				config: request.config,
				onProgress: (progress) => {
					get.set(progressAtom, {
						progress: {
							...progress,
							percent: Math.round(progress.percent * 0.9),
						},
						request,
					});
				},
			});
			get.set(progressAtom, {
				progress: {
					label: "Laying out flow",
					percent: 95,
				},
				request,
			});
			const layout = yield* layoutInWorkerFx(flow);
			get.set(progressAtom, {
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
	return {
		commandAtom,
		progressAtom,
	};
};

/** Owns one subscription-scoped build of the complete authored game flow. */
export const useOriginFlow = (config: EditorItemOriginFlowRequest["config"]): State => {
	const { commandAtom, progressAtom } = useMemo(createAtoms, []);
	const request = useMemo<CommandRequest>(
		() => ({
			config,
		}),
		[
			config,
		],
	);
	const [result, runFlow] = useAtom(commandAtom);
	const progressState = useAtomValue(progressAtom);

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
