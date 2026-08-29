import { Effect } from "effect";

const pngMagic = [
	137,
	80,
	78,
	71,
	13,
	10,
	26,
	10,
] as const;

export const PngResourceLimits = {
	maxBytes: 16 * 1024 * 1024,
	maxDimension: 8192,
	maxPixels: 16 * 1024 * 1024,
} as const;

/** Decodes one bounded PNG and releases the temporary browser bitmap. */
export const validatePngResourceFx = Effect.fn("validatePngResourceFx")(
	(bytes: Uint8Array, resourceId: string) =>
		Effect.scoped(
			Effect.gen(function* () {
				const hasPngEnvelope =
					bytes.byteLength >= 24 &&
					bytes.byteLength <= PngResourceLimits.maxBytes &&
					pngMagic.every((byte, index) => bytes[index] === byte);
				if (!hasPngEnvelope) {
					return yield* Effect.fail(
						new Error(`Resource ${resourceId} must be a valid bounded PNG image.`),
					);
				}
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
							new Error(`Resource ${resourceId} must decode as a valid PNG image.`, {
								cause,
							}),
					}),
					(bitmap) => Effect.sync(() => bitmap.close()),
				);
				const { height, width } = bitmap;
				if (
					width < 1 ||
					height < 1 ||
					width > PngResourceLimits.maxDimension ||
					height > PngResourceLimits.maxDimension ||
					width * height > PngResourceLimits.maxPixels
				) {
					return yield* Effect.fail(
						new Error(`Resource ${resourceId} exceeds the supported PNG dimensions.`),
					);
				}
			}),
		),
);
