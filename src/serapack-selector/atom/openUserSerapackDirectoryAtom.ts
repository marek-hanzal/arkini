import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { createElectronSerapackStorageFx } from "~/serapack-catalog/fx/createElectronSerapackStorageFx";

/** Opens the user-owned Serapack directory through the renderer storage capability. */
export const openUserSerapackDirectoryAtom = Atom.fn(
	(_void: void) =>
		Effect.yieldNow.pipe(
			Effect.andThen(createElectronSerapackStorageFx()),
			Effect.flatMap((storage) => storage.openUserDirectoryFx),
		),
	{
		concurrent: true,
	},
);
