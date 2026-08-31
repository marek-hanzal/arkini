import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProjectTransport } from "~electron/contract/editor/EditorProjectTransport";

type EditorServiceStatus =
	| {
			readonly type: "starting";
	  }
	| EditorProjectTransport.ServiceStatus;

/** Latest editor-service readiness snapshot, independent from gameplay startup. */
export const EditorServiceStatusAtom = Atom.make<EditorServiceStatus>({
	type: "starting",
}).pipe(Atom.keepAlive);
