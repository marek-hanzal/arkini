import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { RendererAtomRuntime } from "~/application-runtime/atom/RendererAtomRegistry";
import { LauncherStartupConfigAtom } from "~/ui/launcher/LauncherStartupConfigAtom";
import { prepareLauncherHeroFx } from "~/ui/launcher/prepareLauncherHeroFx";

/**
 * Owns the decoded Hero resource for one attempt.
 *
 * Refresh closes the previous attempt scope and revokes an owned object URL
 * exactly once before preparing the replacement.
 */
export const LauncherHeroAtom = RendererAtomRuntime.atom((get) => {
	const config = get(LauncherStartupConfigAtom);
	if (config === undefined) {
		return Effect.fail(new Error("Launcher startup is not configured."));
	}
	if (config.bootstrapFx !== undefined) {
		return Effect.succeed({
			owned: false,
			url: config.heroUrl,
		} satisfies prepareLauncherHeroFx.Result);
	}
	return Effect.acquireRelease(
		prepareLauncherHeroFx({
			fallbackUrl: config.heroUrl,
		}),
		(candidate) =>
			candidate.owned ? Effect.sync(() => URL.revokeObjectURL(candidate.url)) : Effect.void,
		{
			interruptible: true,
		},
	);
}).pipe(Atom.keepAlive);
