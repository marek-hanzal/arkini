import { Effect } from "effect";

import { EditorProjectIdSchema } from "../../contract/editor/EditorProjectIdSchema";
import { ElectronMainError } from "../ElectronMainError";

/** Rejects project identities that could escape or alias the editor workspace root. */
export const assertEditorProjectIdFx = Effect.fn("assertEditorProjectIdFx")(
	(projectId: string) =>
		Effect.try({
			try: () => EditorProjectIdSchema.parse(projectId),
			catch: (cause) =>
				new ElectronMainError({
					operation: "Invalid Arkini editor project identity",
					cause,
				}),
		}),
);
