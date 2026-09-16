import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Effect } from "effect";

const execFileAsyncFn = promisify(execFile);

const isMissingCommandFn = (cause: unknown) =>
	typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT";

/** Uses only a PATH-visible FFmpeg to stream one source into canonical Ogg/Opus. */
export const transcodeEditorAudioFileFx = Effect.fn("transcodeEditorAudioFileFx")(
	(source: string, target: string) =>
		Effect.tryPromise({
			try: () =>
				execFileAsyncFn(
					"ffmpeg",
					[
						"-nostdin",
						"-hide_banner",
						"-loglevel",
						"error",
						"-y",
						"-i",
						source,
						"-map",
						"0:a:0",
						"-vn",
						"-map_metadata",
						"-1",
						"-c:a",
						"libopus",
						"-ar",
						"48000",
						"-f",
						"ogg",
						target,
					],
					{
						maxBuffer: 1024 * 1024,
						windowsHide: true,
					},
				),
			catch: (cause) =>
				isMissingCommandFn(cause)
					? new Error("This file is not Ogg/Opus and FFmpeg is unavailable in PATH.", {
							cause,
						})
					: new Error("FFmpeg could not convert this audio file to Ogg/Opus.", {
							cause,
						}),
		}).pipe(Effect.asVoid),
);
