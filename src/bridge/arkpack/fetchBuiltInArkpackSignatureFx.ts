import { Effect } from "effect";

import { ArkpackLoadError } from "~/bridge/arkpack/ArkpackLoadError";
import type { BuiltInArkpack } from "~/bridge/arkpack/BuiltInArkpack";

export namespace fetchBuiltInArkpackSignatureFx {
	export interface Props {
		readonly arkpack: BuiltInArkpack;
	}
}

/** Fetches and parses one bundled detached-signature sidecar when present. */
export const fetchBuiltInArkpackSignatureFx = Effect.fn("fetchBuiltInArkpackSignatureFx")(
	({ arkpack }: fetchBuiltInArkpackSignatureFx.Props) => {
		if (arkpack.signatureUrl === undefined) return Effect.succeed(undefined);
		const signatureUrl = arkpack.signatureUrl;
		return Effect.tryPromise({
			try: async () => {
				const response = await fetch(signatureUrl);
				if (!response.ok) {
					throw new Error(
						`Unable to load bundled ${arkpack.packageId} signature: ${response.status} ${response.statusText}.`,
					);
				}
				const source = await response.text();
				try {
					return JSON.parse(source) as unknown;
				} catch {
					return source;
				}
			},
			catch: (cause) =>
				new ArkpackLoadError({
					operation: "fetch-signature",
					packageId: arkpack.packageId,
					cause,
					message:
						cause instanceof Error
							? cause.message
							: `Unable to load bundled ${arkpack.packageId} signature.`,
				}),
		});
	},
);
