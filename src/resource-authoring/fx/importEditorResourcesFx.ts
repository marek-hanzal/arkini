import { Effect } from "effect";
import { z } from "zod";

import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { invokeProjectTransportFx } from "~/project-authoring/fx/invokeProjectTransportFx";
import { ProjectPayloadSchema } from "~/project-authoring/schema/ProjectPayloadSchema";
import type { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

export namespace importEditorResourcesFx {
	export type Props =
		| {
				readonly file: File;
				readonly projectId: string;
				readonly source: "arkpack";
				readonly type: ResourceTypeSchema.Type;
		  }
		| {
				readonly files: ReadonlyArray<File>;
				readonly projectId: string;
				readonly source: "files";
				readonly type: ResourceTypeSchema.Type;
		  };
}

const resultSchema = z
	.object({
		project: ProjectPayloadSchema,
		resourceIds: IdSchema.array(),
	})
	.strict();

/** Imports one semantic resource type by native path and publishes the resulting project. */
export const importEditorResourcesFx = Effect.fn("importEditorResourcesFx")(function* (
	props: importEditorResourcesFx.Props,
) {
	const files =
		props.source === "arkpack"
			? [
					props.file,
				]
			: props.files;
	const admission = yield* ProjectWriteAdmission;
	return yield* admission.admitWriteFx(
		"upsert-resource",
		Effect.uninterruptible(
			Effect.gen(function* () {
				const result = yield* invokeProjectTransportFx({
					callFn: () =>
						window.arkini.editor.importResourcesFn({
							files: files.map((file) => ({
								name: file.name,
								path: window.arkini.file.readPathFn(file),
							})),
							projectId: props.projectId,
							source: props.source,
							type: props.type,
						}),
					operation: "upsert-resource",
					parseFn: (value) => resultSchema.parse(value),
					requestMessage: `The selected ${props.type} could not be imported.`,
					responseMessage: `The imported ${props.type} response is invalid.`,
				});
				yield* publishEditorProjectFx(props.projectId, {
					project: result.project,
				});
				return result;
			}),
		),
	);
});
