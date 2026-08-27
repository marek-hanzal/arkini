import { Effect } from "effect";

import type { EditorProjectTransport } from "../../../electron/contract/editor/EditorProjectTransport";
import { invokeEditorProjectTransportFx } from "./invokeEditorProjectTransportFx";

/** Requests the native folder action for one exact invalid project candidate. */
export const openInvalidEditorProjectDirectoryFx = Effect.fn("openInvalidEditorProjectDirectoryFx")(
	(root: string) =>
		invokeEditorProjectTransportFx<void, void>({
			call: () => window.arkini.editor.openProjectDirectory(root),
			operation: "open-project-directory" satisfies EditorProjectTransport.Operation,
			parse: () => undefined,
			requestMessage: "The invalid Editor project folder request failed.",
			responseMessage: "The invalid Editor project folder response is invalid.",
		}),
);
