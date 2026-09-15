import { Effect } from "effect";
import { z } from "zod";

import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { invokeProjectTransportFx } from "~/project-authoring/fx/invokeProjectTransportFx";
import { ProjectPayloadSchema } from "~/project-authoring/schema/ProjectPayloadSchema";

type ImportEditorAssetsProps =
	| {
			readonly file: File;
			readonly projectId: string;
			readonly source: "arkpack";
	  }
	| {
			readonly files: ReadonlyArray<File>;
			readonly projectId: string;
			readonly source: "files";
	  };

const resultSchema = z
	.object({
		project: ProjectPayloadSchema,
		resourceIds: IdSchema.array(),
	})
	.strict();

/** Imports selected assets by native path and publishes the resulting project. */
export const importEditorAssetsFx = Effect.fn("importEditorAssetsFx")(function* (
	props: ImportEditorAssetsProps,
) {
	const files =
		props.source === "arkpack"
			? [
					props.file,
				]
			: props.files;
	const result = yield* invokeProjectTransportFx({
		callFn: () =>
			window.arkini.editor.importAssetsFn({
				files: files.map((file) => ({
					name: file.name,
					path: window.arkini.file.readPathFn(file),
				})),
				projectId: props.projectId,
				source: props.source,
			}),
		operation: "upsert-resource",
		parseFn: (value) => resultSchema.parse(value),
		requestMessage: "The selected assets could not be imported.",
		responseMessage: "The imported asset response is invalid.",
	});
	yield* publishEditorProjectFx(props.projectId, {
		project: result.project,
	});
	return result;
});
