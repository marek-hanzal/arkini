import { Effect } from "effect";
import { z } from "zod";

import type { EditorProjectTransport } from "../../../electron/contract/editor/EditorProjectTransport";
import { invokeEditorProjectTransportFx } from "~/bridge/editor/invokeEditorProjectTransportFx";

export const EditorSourceExportSchema = z
	.object({
		json: z.number().int().positive(),
		resources: z.number().int().nonnegative(),
		revision: z.number().int().nonnegative(),
		root: z.string().min(1),
	})
	.strict();

export type EditorSourceExport = z.infer<typeof EditorSourceExportSchema>;

/** Invokes creation of one new Editor JSON export folder through the typed preload boundary. */
export const exportEditorJsonDirectoryFx = Effect.fn("exportEditorJsonDirectoryFx")(
	(projectId: string) =>
		invokeEditorProjectTransportFx<
			EditorProjectTransport.SourceExport | null,
			EditorSourceExport | null
		>({
			call: () => window.arkini.editor.exportJsonDirectory(projectId),
			operation: "export-json-directory",
			parse: (value) => (value === null ? null : EditorSourceExportSchema.parse(value)),
			requestMessage: "The editor JSON export request failed.",
			responseMessage: "The editor JSON export response is invalid.",
		}),
);
