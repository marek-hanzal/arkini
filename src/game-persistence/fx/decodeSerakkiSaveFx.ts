import { Data, Effect } from "effect";
import { SerakkiSaveSchema } from "~/game-persistence/schema/SerakkiSaveSchema";
import { admitSerakkiVersionFx } from "~/application-version/fx/admitSerakkiVersionFx";

class SerakkiSaveDecodeError extends Data.TaggedError("SerakkiSaveDecodeError")<{
	readonly cause: unknown;
}> {}

/** Decodes and validates one complete Serakki save without constructing a live session. */
export const decodeSerakkiSaveFx = Effect.fn("decodeSerakkiSaveFx")((bytes: Uint8Array) =>
	Effect.try({
		try: () =>
			SerakkiSaveSchema.parse(
				JSON.parse(
					new TextDecoder("utf-8", {
						fatal: true,
					}).decode(bytes),
				),
			),
		catch: (cause) =>
			new SerakkiSaveDecodeError({
				cause,
			}),
	}).pipe(Effect.tap((save) => admitSerakkiVersionFx("save", save.serakki))),
);
