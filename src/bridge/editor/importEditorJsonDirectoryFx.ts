import { Effect } from "effect";

import type { EditorProjectTransport } from "../../../electron/contract/editor/EditorProjectTransport";
import {
	EditorProjectDescriptorSchema,
	type EditorProjectDescriptor,
} from "~/bridge/editor/EditorProjectDescriptor";
import { invokeEditorProjectTransportFx } from "~/bridge/editor/invokeEditorProjectTransportFx";

/** Invokes the main-process JSON directory importer through the typed preload boundary. */
export const importEditorJsonDirectoryFx = Effect.fn("importEditorJsonDirectoryFx")(() =>
	invokeEditorProjectTransportFx<
		EditorProjectTransport.Descriptor | null,
		EditorProjectDescriptor | null
	>({
		call: () => window.arkini.editor.importJsonDirectory(),
		operation: "import-json-directory",
		parse: (value) => (value === null ? null : EditorProjectDescriptorSchema.parse(value)),
		requestMessage: "The editor JSON import request failed.",
		responseMessage: "The editor JSON import response is invalid.",
	}),
);
