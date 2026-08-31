import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { createElectronArkpackStorageFx } from "~/arkpack-catalog/fx/createElectronArkpackStorageFx";

/** Opens the user-owned Arkpack directory through the renderer storage capability. */
export const openUserArkpackDirectoryAtom = Atom.fn(
	(_void: void) =>
		Effect.yieldNow.pipe(
			Effect.andThen(createElectronArkpackStorageFx()),
			Effect.flatMap((storage) => storage.openUserDirectoryFx),
		),
	{
		concurrent: true,
	},
);
