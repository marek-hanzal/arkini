import { Effect } from "effect";

import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

/** Decodes bounded PNG bytes and releases the temporary browser bitmap. */
export const readEditorPngDimensionsFx = Effect.fn("readEditorPngDimensionsFx")(
	(bytes: Uint8Array, resourceId: string) =>
		Effect.scoped(
			Effect.gen(function* () {
				const bitmap = yield* Effect.acquireRelease(
					Effect.tryPromise({
						try: () =>
							createImageBitmap(
								new Blob(
									[
										bytes.slice().buffer,
									],
									{
										type: "image/png",
									},
								),
							),
						catch: (cause) =>
							new EditorProjectError({
								reason: "invalid-asset",
								message: `Asset ${resourceId} must decode as a valid PNG image.`,
								cause,
							}),
					}),
					(bitmap) => Effect.sync(() => bitmap.close()),
				);
				return {
					height: bitmap.height,
					width: bitmap.width,
				};
			}),
		),
);
