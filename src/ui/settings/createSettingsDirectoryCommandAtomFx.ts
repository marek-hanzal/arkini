import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { readExactCauseFailureFn } from "~/renderer/diagnostics/fn/readExactCauseFailureFn";

export type SettingsDirectoryCommandState =
	| {
			readonly kind: "idle" | "pending";
	  }
	| {
			readonly kind: "error";
			readonly error: unknown;
	  };

/** Builds one independent Settings-owned directory command with shared lifecycle semantics. */
export const createSettingsDirectoryCommandAtomFx = Effect.fn(
	"createSettingsDirectoryCommandAtomFx",
)((openDirectoryFx: Effect.Effect<void, unknown>) =>
	Effect.sync(() => {
		const stateAtom = Atom.make<SettingsDirectoryCommandState>({
			kind: "idle",
		}).pipe(Atom.keepAlive);
		const runnerAtom = Atom.fn(
			(_: void) =>
				Effect.gen(function* () {
					const result = yield* Effect.exit(openDirectoryFx);
					if (Exit.isFailure(result)) {
						if (Cause.hasInterruptsOnly(result.cause))
							yield* Effect.failCause(result.cause);
						const failure = readExactCauseFailureFn(result.cause);
						yield* Atom.set(stateAtom, {
							kind: "error",
							error: Option.isSome(failure) ? failure.value : result.cause,
						});
						return;
					}
					yield* Atom.set(stateAtom, {
						kind: "idle",
					});
				}),
			{
				concurrent: false,
			},
		).pipe(Atom.keepAlive);

		return Atom.writable(
			(get) => get(stateAtom),
			(context) => {
				if (context.get(stateAtom).kind === "pending") return;
				context.set(stateAtom, {
					kind: "pending",
				});
				context.set(runnerAtom, undefined);
			},
		).pipe(Atom.keepAlive);
	}),
);
