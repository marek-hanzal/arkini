import { Cause, Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

type ExportDiagnosticsState =
	| {
			readonly kind: "idle" | "pending";
	  }
	| {
			readonly kind: "error";
			readonly error: unknown;
	  };

const stateAtom = Atom.make<ExportDiagnosticsState>({
	kind: "idle",
}).pipe(Atom.keepAlive);

const runnerAtom = Atom.fn((_: void) =>
	Effect.gen(function* () {
		const result = yield* Effect.exit(
			Effect.tryPromise({
				try: () => window.serakki.diagnostics.exportFn(),
				catch: (cause) => cause,
			}),
		);
		if (Exit.isFailure(result)) {
			if (Cause.hasInterruptsOnly(result.cause)) return yield* Effect.failCause(result.cause);
			yield* Atom.set(stateAtom, {
				kind: "error",
				error: Cause.squash(result.cause),
			});
			return;
		}
		yield* Atom.set(stateAtom, {
			kind: "idle",
		});
	}),
).pipe(Atom.keepAlive);

/** Owns the one-at-a-time native diagnostics export initiated from Main Menu. */
export const ExportDiagnosticsAtom = Atom.writable(
	(get) => get(stateAtom),
	(context) => {
		if (context.get(stateAtom).kind === "pending") return;
		context.set(stateAtom, {
			kind: "pending",
		});
		context.set(runnerAtom, undefined);
	},
).pipe(Atom.keepAlive);
