import { Effect } from "effect";
import type { EditorItemOriginFlowProgress } from "~/flow/domain/EditorItemOriginFlow";

export type EditorItemOriginFlowPhase = "indexing" | "resolving" | "finalizing";

const ProgressLabels: Record<EditorItemOriginFlowPhase, string> = {
	indexing: "Indexing sources",
	resolving: "Resolving reachability",
	finalizing: "Preparing flow",
};

/** Reports one normalized phase boundary for editor origin-flow construction. */
export const reportEditorItemOriginFlowProgressFx = Effect.fn(
	"reportEditorItemOriginFlowProgressFx",
)(
	(
		onProgress: ((progress: EditorItemOriginFlowProgress) => void) | undefined,
		phase: EditorItemOriginFlowPhase,
		percent: number,
	) =>
		Effect.sync(() =>
			onProgress?.({
				label: ProgressLabels[phase],
				percent: Math.max(0, Math.min(100, Math.round(percent))),
			}),
		),
);
