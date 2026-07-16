import { encode } from "@msgpack/msgpack";
import { Effect } from "effect";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import type { ArkiniSaveSchema } from "~/bridge/save/ArkiniSaveSchema";

/** Encodes one complete canonical gameplay state into the minimal format-1 envelope. */
export const encodeArkiniSaveFx = (state: StateSchema.Type) =>
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
	});
