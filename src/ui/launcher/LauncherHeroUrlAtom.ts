import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { LauncherHeroAtom } from "~/ui/launcher/LauncherHeroAtom";
import { LauncherHeroAsset } from "~/ui/launcher/LauncherHeroAsset";
import { LauncherStartupConfigAtom } from "~/ui/launcher/LauncherStartupConfigAtom";

/** The last safe Hero URL, falling back while a replacement is pending. */
export const LauncherHeroUrlAtom = Atom.make((get) => {
	const config = get(LauncherStartupConfigAtom);
	const hero = get(LauncherHeroAtom);
	return AsyncResult.isSuccess(hero) && !hero.waiting
		? hero.value.url
		: (config?.heroUrl ?? LauncherHeroAsset.url);
});
