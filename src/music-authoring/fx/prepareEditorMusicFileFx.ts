import { Effect, Option } from "effect";

import { validateOggOpusFileFx } from "~/game-config-resource/fx/validateOggOpusFileFx";
import { transcodeEditorMusicFileFx } from "./transcodeEditorMusicFileFx";

/** Keeps canonical Ogg/Opus input intact or converts through a PATH-visible FFmpeg. */
export const prepareEditorMusicFileFx = Effect.fn("prepareEditorMusicFileFx")(function* ({
	id,
	source,
	target,
}: {
	readonly id: string;
	readonly source: string;
	readonly target: string;
}) {
	const canonical = yield* validateOggOpusFileFx(source, id).pipe(Effect.option);
	if (Option.isSome(canonical)) {
		return {
			path: source,
			size: canonical.value,
		};
	}
	yield* transcodeEditorMusicFileFx(source, target);
	return {
		path: target,
		size: yield* validateOggOpusFileFx(target, id),
	};
});
