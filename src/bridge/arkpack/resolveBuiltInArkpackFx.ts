import { Effect } from "effect";
import { ArkiniArkpack } from "~/bridge/arkpack/ArkiniArkpack";
import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import { BuiltInArkpackResolutionError } from "~/bridge/arkpack/BuiltInArkpackResolutionError";

/** Resolves the exact signed Arkini package used for canonical launcher startup. */
export const resolveBuiltInArkpackFx = Effect.fn("resolveBuiltInArkpackFx")(
	(arkpacks: ReadonlyArray<ArkpackDescriptor>) =>
		Effect.gen(function* () {
			const officialArkini = arkpacks.filter(
				(arkpack) =>
					arkpack.packageId === ArkiniArkpack.packageId &&
					arkpack.gameId === "arkini" &&
					arkpack.source === "built-in" &&
					arkpack.trust.type === "official",
			);
			if (officialArkini.length !== 1 || officialArkini[0] === undefined) {
				return yield* Effect.fail(
					new BuiltInArkpackResolutionError({
						packageId: ArkiniArkpack.packageId,
						matchingCount: officialArkini.length,
						message: "Arkini requires its exact official built-in package.",
					}),
				);
			}
			return officialArkini[0];
		}),
);
