import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { readExactCauseFailureFx } from "~/bridge/game/readExactCauseFailureFx";
import { requestApplicationCloseAtom } from "~/bridge/lifecycle/requestApplicationCloseAtom";

export type MainMenuExitCommandState =
	| {
			readonly kind: "idle";
	  }
	| {
			readonly kind: "pending";
	  }
	| {
			readonly kind: "error";
			readonly error: unknown;
	  }
	| {
			readonly kind: "requested";
	  };

const MainMenuExitCommandStateAtom = Atom.make<MainMenuExitCommandState>({
	kind: "idle",
}).pipe(Atom.keepAlive);

const MainMenuExitCommandRunnerAtom = Atom.fn((_input: void, get) =>
	Effect.gen(function* () {
		const exit = yield* Effect.exit(get.setResult(requestApplicationCloseAtom, undefined));
		if (Exit.isFailure(exit)) {
			if (Cause.hasInterruptsOnly(exit.cause)) {
				return yield* Effect.failCause(exit.cause);
			}
			const failure = yield* readExactCauseFailureFx(exit.cause);
			yield* Atom.set(MainMenuExitCommandStateAtom, {
				kind: "error",
				error: Option.isSome(failure) ? failure.value : exit.cause,
			});
			return;
		}
		yield* Atom.set(MainMenuExitCommandStateAtom, {
			kind: "requested",
		});
	}),
).pipe(Atom.keepAlive);

/**
 * Owns one synchronous native-exit request across Main Menu React remounts.
 *
 * TODO(#397): Revalidate stable writable-authority admission and keepAlive semantics;
 * native exit pending/error state must remain registry-owned across remounts.
 */
export const MainMenuExitCommandAtom = Atom.writable(
	(get) => get(MainMenuExitCommandStateAtom),
	(context) => {
		if (context.get(MainMenuExitCommandStateAtom).kind === "pending") return;
		context.set(MainMenuExitCommandStateAtom, {
			kind: "pending",
		});
		context.set(MainMenuExitCommandRunnerAtom, undefined);
	},
).pipe(Atom.keepAlive);
