import { Effect } from "effect";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import {
	createEditorGraphWorkerFx,
	type EditorGraphWorker,
} from "~/graph/worker/createEditorGraphWorkerFx";

type GraphSession =
	| {
			readonly status: "loading";
	  }
	| {
			readonly status: "error";
			readonly message: string;
	  }
	| {
			readonly status: "ready";
			readonly worker: EditorGraphWorker;
	  };
const EditorGraphContext = createContext<GraphSession>({
	status: "loading",
});

/** Lives beneath the project route; all graph surfaces share its scoped worker. */
export const EditorGraphProvider = ({ children }: PropsWithChildren) => {
	const [session, setSessionFn] = useState<GraphSession>({
		status: "loading",
	});
	useEffect(() => {
		const controller = new AbortController();
		void Effect.runPromise(
			Effect.gen(function* () {
				const worker = yield* createEditorGraphWorkerFx();
				setSessionFn({
					status: "ready",
					worker,
				});
				yield* Effect.never;
			}).pipe(Effect.scoped),
			{
				signal: controller.signal,
			},
		).catch((cause: unknown) => {
			if (!controller.signal.aborted)
				setSessionFn({
					status: "error",
					message: cause instanceof Error ? cause.message : String(cause),
				});
		});
		return () => controller.abort();
	}, []);
	return <EditorGraphContext value={session}>{children}</EditorGraphContext>;
};

export const useEditorGraphSession = () => useContext(EditorGraphContext);
