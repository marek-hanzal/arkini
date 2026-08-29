import { Effect } from "effect";

import {
	type EditorArkpackFileInput,
	readSelectedArkpackFileFx,
} from "~/arkpack/renderer/readSelectedArkpackFileFx";
import { upsertEditorResourcesFx } from "~/ui/resource/editor/upsertEditorResourcesFx";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

export namespace importEditorArkpackAssetsFx {
	export interface Props {
		readonly file: EditorArkpackFileInput;
		readonly projectId: string;
	}
}

/** Imports only validated resources from an arkpack, replacing matching project resource IDs. */
export const importEditorArkpackAssetsFx = Effect.fn("importEditorArkpackAssetsFx")(function* ({
	file,
	projectId,
}: importEditorArkpackAssetsFx.Props) {
	const loaded = yield* readSelectedArkpackFileFx(file);
	if (loaded.payload.resources.length === 0) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "invalid-asset",
				message: "The selected arkpack does not contain any assets.",
			}),
		);
	}
	return yield* upsertEditorResourcesFx({
		projectId,
		resources: loaded.payload.resources,
	});
});
