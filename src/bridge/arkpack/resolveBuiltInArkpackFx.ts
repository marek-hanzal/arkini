import { Effect } from "effect";
import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";

/** Resolves the single canonical built-in package from authoritative catalog metadata. */
export const resolveBuiltInArkpackFx = Effect.fn("resolveBuiltInArkpackFx")(
	(arkpacks: ReadonlyArray<ArkpackDescriptor>) =>
		Effect.gen(function* () {
			const builtIn = arkpacks.filter((arkpack) => arkpack.source === "built-in");
			if (builtIn.length !== 1 || builtIn[0] === undefined) {
				return yield* Effect.fail(
					new Error(
						`Arkini requires exactly one built-in package; catalog contains ${builtIn.length}.`,
					),
				);
			}
			return builtIn[0];
		}),
);
