import { Effect } from "effect";

import {
	type EditorArkpackFileInput,
	readSelectedArkpackFileFx,
} from "~/arkpack-admission/fx/readSelectedArkpackFileFx";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { EditorProjectError } from "~/project-authoring/error/EditorProjectError";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
import {
	type EditorAssetFileInput,
	validateEditorAssetFileFx,
} from "~/asset-authoring/fx/validateEditorAssetFileFx";

type ImportEditorAssetsProps =
	| {
			readonly file: EditorArkpackFileInput;
			readonly projectId: string;
			readonly source: "arkpack";
	  }
	| {
			readonly files: ReadonlyArray<EditorAssetFileInput>;
			readonly projectId: string;
			readonly source: "files";
	  };

const readEditorAssetImportResourcesFx = Effect.fn("readEditorAssetImportResourcesFx")(function* (
	props: ImportEditorAssetsProps,
) {
	if (props.source === "arkpack") {
		const loaded = yield* readSelectedArkpackFileFx(props.file);
		if (loaded.payload.resources.length > 0) return loaded.payload.resources;
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "invalid-asset",
				message: "The selected arkpack does not contain any assets.",
			}),
		);
	}
	if (props.files.length === 0) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "invalid-asset",
				message: "Select at least one PNG asset to import.",
			}),
		);
	}
	const resources: ReadonlyArray<ResourceSchema.Type> = yield* Effect.forEach(
		props.files,
		(file) => validateEditorAssetFileFx(file),
		{
			concurrency: 4,
		},
	);
	const resourceIds = new Set<string>();
	for (const resource of resources) {
		if (resourceIds.has(resource.id)) {
			return yield* Effect.fail(
				new EditorProjectError({
					reason: "invalid-resource-id",
					message: `Asset ID ${resource.id} occurs more than once in the selected batch.`,
				}),
			);
		}
		resourceIds.add(resource.id);
	}
	return resources;
});

/** Validates one PNG or Arkpack source and atomically publishes its assets. */
export const importEditorAssetsFx = Effect.fn("importEditorAssetsFx")(function* (
	props: ImportEditorAssetsProps,
) {
	const resources = yield* readEditorAssetImportResourcesFx(props);
	const repository = yield* EditorProjectRepository;
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const project = yield* repository.upsertResourcesFx({
				projectId: props.projectId,
				resources,
			});
			yield* publishEditorProjectFx(props.projectId, {
				project,
			});
			return {
				project,
				resourceIds: resources.map(({ id }) => id),
			};
		}),
	);
});
