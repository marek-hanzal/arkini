import { Effect } from "effect";
import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";

/** Resolves the single official built-in package used for canonical launcher startup. */
export const resolveBuiltInArkpackFx = Effect.fn("resolveBuiltInArkpackFx")(
	(arkpacks: ReadonlyArray<ArkpackDescriptor>) =>
		Effect.gen(function* () {
			const official = arkpacks.filter(
				(arkpack) => arkpack.source === "built-in" && arkpack.trust.type === "official",
			);
			if (official.length !== 1 || official[0] === undefined) {
				return yield* Effect.fail(
					new Error(
						`Arkini requires exactly one official built-in package; catalog contains ${official.length}.`,
					),
				);
			}
			return official[0];
		}),
);
