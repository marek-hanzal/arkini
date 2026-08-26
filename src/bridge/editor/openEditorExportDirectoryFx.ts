import { Effect } from "effect";

import { invokeEditorProjectTransportFx } from "~/bridge/editor/invokeEditorProjectTransportFx";

/** Opens one completed Editor project export through the typed preload boundary. */
export const openEditorExportDirectoryFx = Effect.fn("openEditorExportDirectoryFx")(() =>
	invokeEditorProjectTransportFx<void, void>({
		call: () => window.arkini.editor.openExportDirectory(),
		operation: "open-export-directory",
		parse: () => undefined,
		requestMessage: "The Editor project export folder request failed.",
		responseMessage: "The Editor project export folder response is invalid.",
	}),
);
