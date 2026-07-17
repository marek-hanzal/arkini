import { encode } from "@msgpack/msgpack";
import { Effect } from "effect";
import type { ArkiniSaveSchema } from "~/bridge/save/ArkiniSaveSchema";
import type { StateSchema } from "~/engine/state/schema/StateSchema";

/** Encodes one complete canonical gameplay state into the minimal format-1 envelope. */
export const encodeArkiniSaveFx = Effect.fn("encodeArkiniSaveFx")((state: StateSchema.Type) =>
	Effect.try({
		try: () =>
			encode(
				{
					namespace: "arkini",
					format: 1,
					state,
				} satisfies ArkiniSaveSchema.Type,
				{
					ignoreUndefined: true,
				},
			),
		catch: (cause) => cause,
	}),
);
