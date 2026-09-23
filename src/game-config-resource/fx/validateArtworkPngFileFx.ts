import { Effect } from "effect";
import sharp from "sharp";

import { validatePngResourceFileFx } from "~/game-config-resource/fx/validatePngResourceFileFx";

/** Validates the square shape required by one Artwork source without reading its body into JS. */
export const validateArtworkPngFileFx = Effect.fn("validateArtworkPngFileFx")(
	(path: string, resourceUid: string) =>
		Effect.gen(function* () {
			const size = yield* validatePngResourceFileFx(path, resourceUid);
			const metadata = yield* Effect.tryPromise({
				try: () => sharp(path).metadata(),
				catch: (cause) =>
					new Error(`Artwork ${resourceUid} must decode as a square PNG image.`, {
						cause,
					}),
			});
			if (metadata.width !== metadata.height)
				return yield* Effect.fail(
					new Error(`Artwork ${resourceUid} must be a square PNG image.`),
				);
			return size;
		}),
);
