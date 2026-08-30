import { decode } from "@msgpack/msgpack";
import { Data, Effect } from "effect";
import { ArkiniSaveSchema } from "~/game-persistence/schema/ArkiniSaveSchema";
import { admitArkiniVersionFx } from "~/engine/version/ArkiniVersionAdmission";

class ArkiniSaveDecodeError extends Data.TaggedError("ArkiniSaveDecodeError")<{
	readonly cause: unknown;
}> {}

/** Decodes and validates one complete Arkini save without constructing a live session. */
export const decodeArkiniSaveFx = Effect.fn("decodeArkiniSaveFx")((bytes: Uint8Array) =>
	Effect.try({
		try: () => ArkiniSaveSchema.parse(decode(bytes)),
		catch: (cause) =>
			new ArkiniSaveDecodeError({
				cause,
			}),
	}).pipe(Effect.tap((save) => admitArkiniVersionFx("save", save.arkini))),
);
