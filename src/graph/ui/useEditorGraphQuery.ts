import type { EditorGraphWorker } from "~/graph/worker/createEditorGraphWorkerFx";
import { Effect } from "effect";
import { useEffect, useState } from "react";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useEditorGraphSession } from "~/graph/ui/EditorGraphProvider";
import type { GraphQuerySchema } from "~/graph/schema/GraphQuerySchema";
import type { GraphResult } from "~/graph/type/GraphResult";
import type { Project } from "~/project-authoring/type/Project";

export type EditorGraphQueryState =
	| {
			readonly status: "loading";
	  }
	| {
			readonly status: "error";
			readonly message: string;
	  }
	| {
			readonly status: "ready";
			readonly result: GraphResult;
	  };

/** Cancels obsolete requests and never renders a result against another live revision or query. */
export const useEditorGraphQuery = (query: GraphQuerySchema.Type): EditorGraphQueryState => {
	const project = useEditorProject();
	const session = useEditorGraphSession();
	const [settled, setSettledFn] = useState<{
		readonly project: Project;
		readonly worker: EditorGraphWorker;
		readonly query: GraphQuerySchema.Type;
		readonly state: EditorGraphQueryState;
	}>();
	useEffect(() => {
		if (session.status !== "ready") return;
		const controller = new AbortController();
		void Effect.runPromise(session.worker.queryFx(project, query), {
			signal: controller.signal,
		})
			.then((result) => {
				if (!controller.signal.aborted)
					setSettledFn({
						project,
						worker: session.worker,
						query,
						state: {
							status: "ready",
							result,
						},
					});
			})
			.catch((cause: unknown) => {
				if (!controller.signal.aborted)
					setSettledFn({
						project,
						worker: session.worker,
						query,
						state: {
							status: "error",
							message: cause instanceof Error ? cause.message : String(cause),
						},
					});
			});
		return () => controller.abort();
	}, [
		project,
		query,
		session,
	]);
	if (session.status !== "ready") return session;
	return settled?.project === project &&
		settled.worker === session.worker &&
		settled.query === query
		? settled.state
		: {
				status: "loading",
			};
};
