import { Effect } from "effect";

import { invokeEditorProjectTransportFx } from "~/bridge/editor/invokeEditorProjectTransportFx";

/** Opens one completed JSON source export through the typed preload boundary. */
export const openEditorExportDirectoryFx = Effect.fn("openEditorExportDirectoryFx")(() =>
	invokeEditorProjectTransportFx<void, void>({
		call: () => window.arkini.editor.openExportDirectory(),
		operation: "open-export-directory",
		parse: () => undefined,
		requestMessage: "The JSON source export folder request failed.",
		responseMessage: "The JSON source export folder response is invalid.",
	}),
);
