import { decode } from "@msgpack/msgpack";
import { Effect } from "effect";
import { ArkiniSaveDecodeError } from "~/bridge/save/ArkiniSaveDecodeError";
import { ArkiniSaveSchema } from "~/bridge/save/ArkiniSaveSchema";

/** Decodes and validates one complete Arkini save without constructing a live session. */
export const decodeArkiniSaveFx = Effect.fn("decodeArkiniSaveFx")((bytes: Uint8Array) =>
	Effect.try({
		try: () => ArkiniSaveSchema.parse(decode(bytes)),
		catch: (cause) =>
			new ArkiniSaveDecodeError({
				cause,
			}),
	}),
);
