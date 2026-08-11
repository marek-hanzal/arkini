import { useAtom, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useEffect, useMemo } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type {
	EditorItemEstimateIndexEntry,
	EditorItemEstimateIndexProgress,
} from "~/editor/EditorItemEstimateIndex";
import { readSettledAsyncResultError } from "~/ui/reactivity/readSettledAsyncResultError";
import { runEditorItemEstimateInWorkerFx } from "~/ui/item/editor/runEditorItemEstimateInWorkerFx";

export type EditorItemEstimateIndexState =
	| {
			readonly completed: number;
			readonly status: "loading";
			readonly total: number;
	  }
	| {
			readonly entries: ReadonlyArray<EditorItemEstimateIndexEntry>;
			readonly status: "ready";
	  }
	| {
			readonly message: string;
			readonly status: "error";
	  };

interface EditorItemEstimateIndexRequest {
	readonly config: EditorProject["config"];
}

interface EditorItemEstimateIndexProgressState {
	readonly progress: EditorItemEstimateIndexProgress;
	readonly request?: EditorItemEstimateIndexRequest;
}

/** Owns one subscription-scoped all-item estimate for the current project snapshot. */
export const useEditorItemEstimateIndex = (
	config: EditorProject["config"],
): EditorItemEstimateIndexState => {
	const { commandAtom, progressAtom } = useMemo(() => {
		const progressAtom = Atom.make<EditorItemEstimateIndexProgressState>({
			progress: {
				completed: 0,
				itemId: "",
				total: 0,
			},
		}).pipe(Atom.setIdleTTL(0));
		const commandAtom = Atom.fn((request: EditorItemEstimateIndexRequest, get) =>
			Effect.gen(function* () {
				get.set(progressAtom, {
					progress: {
						completed: 0,
						itemId: "",
						total: Object.keys(request.config.items).length,
					},
					request,
				});
				const result = yield* runEditorItemEstimateInWorkerFx(
					{
						config: request.config,
						type: "index",
					},
					{
						onProgress: (progress) =>
							get.set(progressAtom, {
								progress,
								request,
							}),
					},
				);
				if (result.type !== "index")
					return yield* Effect.die(
						new Error("Estimate index worker returned an item result."),
					);
				return {
					entries: result.entries,
					request,
				};
			}),
		).pipe(Atom.setIdleTTL(0));
		return {
			commandAtom,
			progressAtom,
		};
	}, []);
	const request = useMemo<EditorItemEstimateIndexRequest>(
		() => ({
			config,
		}),
		[
			config,
		],
	);
	const [result, runEstimate] = useAtom(commandAtom);
	const progressState = useAtomValue(progressAtom);

	useEffect(() => {
		runEstimate(request);
	}, [
		request,
		runEstimate,
	]);

	if (AsyncResult.isSuccess(result) && !result.waiting && result.value.request === request)
		return {
			entries: result.value.entries,
			status: "ready",
		};
	const error = readSettledAsyncResultError(result);
	if (error !== undefined && progressState.request === request)
		return {
			message: error.message,
			status: "error",
		};
	const progress =
		progressState.request === request
			? progressState.progress
			: {
					completed: 0,
					itemId: "",
					total: Object.keys(config.items).length,
				};
	return {
		completed: progress.completed,
		status: "loading",
		total: progress.total,
	};
};
