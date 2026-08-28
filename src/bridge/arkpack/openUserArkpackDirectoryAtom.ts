import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { createArkpackStorageFx } from "~/bridge/arkpack/createArkpackStorageFx";

/** Opens the user-owned Arkpack directory through the renderer storage capability. */
export const openUserArkpackDirectoryAtom = Atom.fn(
	(_void: void) =>
		Effect.yieldNow.pipe(
			Effect.andThen(createArkpackStorageFx()),
			Effect.flatMap((storage) => storage.openUserDirectoryFx),
		),
	{
		concurrent: true,
	},
);
