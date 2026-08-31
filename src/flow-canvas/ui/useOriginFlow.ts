import { useAtom, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useEffect, useMemo } from "react";

import { type ItemOriginFlow, type ItemOriginFlowProgress } from "~/flow/type/ItemOriginFlow";
import { readItemOriginFlowFx, type ItemOriginFlowRequest } from "~/flow/fx/readItemOriginFlowFx";
import type { LayoutNode, LayoutPoint } from "~/flow-layout/type/Layout";
import { layoutInWorkerFx } from "~/flow-layout/fx/layoutInWorkerFx";

type State =
	| {
			readonly flow: undefined;
			readonly progress: ItemOriginFlowProgress;
			readonly status: "loading";
	  }
	| {
			readonly backbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
			readonly flow: ItemOriginFlow;
			readonly positions: ReadonlyMap<string, LayoutNode>;
			readonly progress: ItemOriginFlowProgress;
			readonly status: "ready";
	  }
	| {
			readonly flow: undefined;
			readonly progress: ItemOriginFlowProgress;
			readonly status: "error";
	  };

interface CommandRequest {
	readonly config: ItemOriginFlowRequest["config"];
}

interface ProgressState {
	readonly progress: ItemOriginFlowProgress;
	readonly request?: CommandRequest;
}

const InitialProgress: ItemOriginFlowProgress = {
	label: "Preparing flow",
	percent: 0,
};

const FailedProgress: ItemOriginFlowProgress = {
	label: "Flow failed",
	percent: 0,
};

const createAtomsFn = () => {
	const progressAtom = Atom.make<ProgressState>({
		progress: InitialProgress,
	}).pipe(Atom.setIdleTTL(0));
	const commandAtom = Atom.fn((request: CommandRequest, get) =>
		Effect.gen(function* () {
			get.set(progressAtom, {
				progress: InitialProgress,
				request,
			});
			const flow = yield* readItemOriginFlowFx({
				config: request.config,
				onProgressFn: (progress) => {
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
export const useOriginFlow = (config: ItemOriginFlowRequest["config"]): State => {
	const { commandAtom, progressAtom } = useMemo(createAtomsFn, []);
	const request = useMemo<CommandRequest>(
		() => ({
			config,
		}),
		[
			config,
		],
	);
	const [result, runFlowFn] = useAtom(commandAtom);
	const progressState = useAtomValue(progressAtom);

	useEffect(() => {
		runFlowFn(request);
	}, [
		request,
		runFlowFn,
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
