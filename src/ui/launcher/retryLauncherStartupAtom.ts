import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { RendererAtomRuntime } from "~/application-runtime/RendererAtomRegistry";
import { LauncherHeroAtom } from "~/ui/launcher/LauncherHeroAtom";
import { LauncherStartupAtom } from "~/ui/launcher/LauncherStartupAtom";

/**
 * Retries completed work while concurrent duplicate requests join the active attempt.
 *
 * TODO(#397): Revalidate stable concurrent refresh joining, waiting, and cancellation
 * semantics without adding a second launcher-startup authority.
 */
export const retryLauncherStartupAtom = RendererAtomRuntime.fn(
	(_input: void) =>
		Effect.gen(function* () {
			const startup = yield* Atom.get(LauncherStartupAtom);
			if (startup.waiting) {
				return yield* Atom.getResult(LauncherStartupAtom, {
					suspendOnWaiting: true,
				});
			}
			yield* Atom.refresh(LauncherHeroAtom);
			yield* Atom.refresh(LauncherStartupAtom);
			return yield* Atom.getResult(LauncherStartupAtom, {
				suspendOnWaiting: true,
			});
		}),
	{
		concurrent: true,
	},
);
