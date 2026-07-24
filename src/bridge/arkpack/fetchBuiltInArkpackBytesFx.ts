import { Effect } from "effect";

import { ArkpackLoadError } from "~/bridge/arkpack/ArkpackLoadError";
import type { BuiltInArkpack } from "~/bridge/arkpack/BuiltInArkpack";

export namespace fetchBuiltInArkpackBytesFx {
	export interface Props {
		readonly arkpack: BuiltInArkpack;
	}
}

/** Fetches one exact bundled Arkpack binary from its generated asset URL. */
export const fetchBuiltInArkpackBytesFx = Effect.fn("fetchBuiltInArkpackBytesFx")(
	({ arkpack }: fetchBuiltInArkpackBytesFx.Props) =>
		Effect.tryPromise({
			try: async () => {
				const response = await fetch(arkpack.url);
				if (!response.ok) {
					throw new Error(
						`Unable to load bundled ${arkpack.packageId} pack: ${response.status} ${response.statusText}.`,
					);
				}
				return new Uint8Array(await response.arrayBuffer());
			},
			catch: (cause) =>
				new ArkpackLoadError({
					operation: "fetch-bytes",
					packageId: arkpack.packageId,
					cause,
					message:
						cause instanceof Error
							? cause.message
							: `Unable to load bundled ${arkpack.packageId} pack.`,
				}),
		}),
);
