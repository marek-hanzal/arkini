import * as Atom from "effect/unstable/reactivity/Atom";

import { invokeEditorProjectTransportFx } from "~/renderer/editor/invokeEditorProjectTransportFx";

/** Owns one request to reveal a successful source export in the OS file browser. */
export const openEditorExportDirectoryCommandAtom = Atom.fn(() =>
	invokeEditorProjectTransportFx({
		call: () => window.arkini.editor.openExportDirectory(),
		operation: "open-export-directory",
		parse: () => undefined,
		requestMessage: "The Editor project export folder request failed.",
		responseMessage: "The Editor project export folder response is invalid.",
	}),
).pipe(Atom.setIdleTTL(0));
