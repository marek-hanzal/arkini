import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProjectTransport } from "../../../electron/contract/editor/EditorProjectTransport";
import { EditorServiceStatusAtom } from "~/project-authoring/atom/EditorServiceStatusAtom";

const EditorServiceReadinessTimeoutMs = 2_000;

const readEditorServiceDidNotRespondFn = (): EditorProjectTransport.ServiceStatus => ({
	type: "unavailable",
	message: "The editor service did not respond.",
});

/** Reads and publishes editor readiness without ever failing the renderer root. */
export const refreshEditorServiceStatusFx = Effect.tryPromise({
	try: () => window.arkini.editor.status(),
	catch: (cause) => cause,
}).pipe(
	Effect.timeoutOrElse({
		duration: EditorServiceReadinessTimeoutMs,
		orElse: () => Effect.succeed(readEditorServiceDidNotRespondFn()),
	}),
	Effect.catch(() => Effect.succeed(readEditorServiceDidNotRespondFn())),
	Effect.tap((status) => Atom.set(EditorServiceStatusAtom, status)),
);
