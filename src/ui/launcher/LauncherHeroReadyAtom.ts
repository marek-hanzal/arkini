import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { LauncherHeroAtom } from "~/ui/launcher/LauncherHeroAtom";

/** True only after the selected Hero has completed its preload/decode contract. */
export const LauncherHeroReadyAtom = Atom.make((get) => {
	const hero = get(LauncherHeroAtom);
	return AsyncResult.isSuccess(hero) && !hero.waiting;
});
