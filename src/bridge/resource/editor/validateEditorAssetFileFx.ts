import { Effect } from "effect";

import { PngResourceLimits, validatePngResourceFx } from "~/bridge/resource/validatePngResourceFx";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import { readEditorAssetResourceIdFx } from "~/bridge/resource/editor/readEditorAssetResourceIdFx";

export interface EditorAssetFileInput {
	readonly name: string;
	readonly size: number;
	readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

export const validateEditorAssetFileFx = Effect.fn("validateEditorAssetFileFx")(function* (
	inputFile: EditorAssetFileInput,
	resourceIdOverride?: string,
) {
	if (
		!inputFile.name.toLowerCase().endsWith(".png") ||
		inputFile.size > PngResourceLimits.maxBytes
	) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "invalid-asset",
				message: `Asset ${inputFile.name} must be a PNG no larger than ${PngResourceLimits.maxBytes} bytes.`,
			}),
		);
	}
	const projectedResourceId =
		resourceIdOverride ?? (yield* readEditorAssetResourceIdFx(inputFile.name));
	const resourceId = yield* Effect.try({
		try: () => IdSchema.parse(projectedResourceId),
		catch: (cause) =>
			new EditorProjectError({
				reason: "invalid-resource-id",
				message: `Asset ${inputFile.name} does not produce a valid resource ID.`,
				cause,
			}),
	});
	const bytes = yield* Effect.tryPromise({
		try: async () => new Uint8Array(await inputFile.arrayBuffer()),
		catch: (cause) =>
			new EditorProjectError({
				reason: "invalid-asset",
				message: `Asset ${resourceId} could not be read.`,
				cause,
			}),
	});
	yield* validatePngResourceFx(bytes, resourceId).pipe(
		Effect.mapError(
			(cause) =>
				new EditorProjectError({
					reason: "invalid-asset",
					message: cause.message.replace(/^Resource /, "Asset "),
					cause,
				}),
		),
	);
	return {
		id: resourceId,
		mime: "image/png",
		bytes,
	} as const;
});
