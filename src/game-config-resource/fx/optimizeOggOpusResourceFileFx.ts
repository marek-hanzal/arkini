import { stat } from "node:fs/promises";
import { Effect } from "effect";

import { transcodeAudioResourceFileFx } from "~/game-config-resource/fx/transcodeAudioResourceFileFx";
import { validateOggOpusFileFx } from "~/game-config-resource/fx/validateOggOpusFileFx";

export namespace optimizeOggOpusResourceFileFx {
	export interface Result {
		readonly changed: boolean;
		readonly originalBytes: number;
		readonly optimizedBytes: number;
		readonly path: string;
	}
}

/** Trims silent edges from one canonical Ogg/Opus file without re-encoding clean audio. */
export const optimizeOggOpusResourceFileFx = Effect.fn("optimizeOggOpusResourceFileFx")(
	(source: string, target: string, resourceUid: string) =>
		Effect.tryPromise({
			try: () => stat(source),
			catch: (cause) =>
				new Error(`Resource ${resourceUid} could not be inspected.`, {
					cause,
				}),
		}).pipe(
			Effect.flatMap((sourceInfo) =>
				transcodeAudioResourceFileFx({
					skipWithoutEdgeTrim: true,
					source,
					target,
				}).pipe(
					Effect.flatMap((changed) =>
						changed
							? validateOggOpusFileFx(target, resourceUid).pipe(
									Effect.map(
										(optimizedBytes): optimizeOggOpusResourceFileFx.Result => ({
											changed: true,
											originalBytes: Number(sourceInfo.size),
											optimizedBytes,
											path: target,
										}),
									),
								)
							: Effect.succeed<optimizeOggOpusResourceFileFx.Result>({
									changed: false,
									originalBytes: Number(sourceInfo.size),
									optimizedBytes: Number(sourceInfo.size),
									path: source,
								}),
					),
				),
			),
			Effect.mapError(
				(cause) =>
					new Error(`Resource ${resourceUid} could not be optimized.`, {
						cause,
					}),
			),
		),
);
