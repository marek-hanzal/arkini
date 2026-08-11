import { useAtom } from "@effect/atom-react";
import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useEffect, useMemo } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorItemSimulation } from "~/editor/simulator/EditorItemSimulation";
import { readSettledAsyncResultError } from "~/ui/reactivity/readSettledAsyncResultError";
import { runEditorItemEstimateInWorkerFx } from "~/ui/item/editor/runEditorItemEstimateInWorkerFx";

export type EditorItemEstimateState =
	| {
			readonly status: "loading";
	  }
	| {
			readonly estimate: EditorItemSimulation;
			readonly status: "ready";
	  }
	| {
			readonly message: string;
			readonly status: "error";
	  };

interface EditorItemEstimateRequest {
	readonly config: EditorProject["config"];
	readonly itemId: string;
}

/** Owns one subscription-scoped estimate for the currently routed item. */
export const useEditorItemEstimate = (
	config: EditorProject["config"],
	itemId: string,
): EditorItemEstimateState => {
	const commandAtom = useMemo(
		() =>
			Atom.fn((request: EditorItemEstimateRequest) =>
				Effect.gen(function* () {
					const result = yield* runEditorItemEstimateInWorkerFx({
						config: request.config,
						itemId: request.itemId,
						type: "item",
					});
					if (result.type !== "item")
						return yield* Effect.die(
							new Error("Estimate item worker returned an index result."),
						);
					return {
						estimate: result.estimate,
						request,
					};
				}),
			).pipe(Atom.setIdleTTL(0)),
		[],
	);
	const request = useMemo<EditorItemEstimateRequest>(
		() => ({
			config,
			itemId,
		}),
		[
			config,
			itemId,
		],
	);
	const [result, runEstimate] = useAtom(commandAtom);

	useEffect(() => {
		runEstimate(request);
	}, [
		request,
		runEstimate,
	]);

	if (AsyncResult.isSuccess(result) && !result.waiting && result.value.request === request)
		return {
			estimate: result.value.estimate,
			status: "ready",
		};
	const error = readSettledAsyncResultError(result);
	return error === undefined
		? {
				status: "loading",
			}
		: {
				message: error.message,
				status: "error",
			};
};
