import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorSourceExportSchema } from "../../../electron/contract/editor/EditorSourceExportSchema";
import { invokeEditorProjectTransportFx } from "~/renderer/editor/invokeEditorProjectTransportFx";

/** Owns one explicit new-folder source export for a canonical editor project. */
export const exportEditorJsonDirectoryCommandAtom = Atom.family((projectId: string) =>
	Atom.fn(() =>
		invokeEditorProjectTransportFx({
			call: () => window.arkini.editor.exportJsonDirectory(projectId),
			operation: "export-json-directory",
			parse: (value) => (value === null ? null : EditorSourceExportSchema.parse(value)),
			requestMessage: "The editor JSON export request failed.",
			responseMessage: "The editor JSON export response is invalid.",
		}),
	).pipe(Atom.setIdleTTL(0)),
);
