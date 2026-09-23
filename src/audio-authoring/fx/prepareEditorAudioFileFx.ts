import { Effect, Option } from "effect";

import { optimizeOggOpusResourceFileFx } from "~/game-config-resource/fx/optimizeOggOpusResourceFileFx";
import { validateOggOpusFileFx } from "~/game-config-resource/fx/validateOggOpusFileFx";
import { transcodeAudioResourceFileFx } from "~/game-config-resource/fx/transcodeAudioResourceFileFx";

/** Produces canonical Ogg/Opus while trimming only detected silent edges through FFmpeg. */
export const prepareEditorAudioFileFx = Effect.fn("prepareEditorAudioFileFx")(function* ({
	uid,
	source,
	target,
}: {
	readonly uid: string;
	readonly source: string;
	readonly target: string;
}) {
	const canonical = yield* validateOggOpusFileFx(source, uid).pipe(Effect.option);
	if (Option.isSome(canonical)) {
		const optimized = yield* optimizeOggOpusResourceFileFx(source, target, uid);
		return {
			path: optimized.path,
			size: optimized.optimizedBytes,
		};
	}
	yield* transcodeAudioResourceFileFx({
		skipWithoutEdgeTrim: false,
		source,
		target,
	});
	return {
		path: target,
		size: yield* validateOggOpusFileFx(target, uid),
	};
});
