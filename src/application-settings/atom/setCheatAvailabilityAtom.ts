import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { applyCheatAvailabilityFx } from "~/application-settings/fx/applyCheatAvailabilityFx";
import { writeCheatAvailabilityFx } from "~/application-settings/fx/writeCheatAvailabilityFx";
import type { CheatAvailabilitySchema } from "~electron/contract/cheat/CheatAvailabilitySchema";

/**
 * Persists application cheat-tool availability before publishing the new renderer value.
 * The write Effect semaphore owns FIFO persistence; concurrent Atom mode keeps earlier writes alive.
 *
 * TODO(#397): Revalidate stable concurrent-command cancellation and FIFO ownership;
 * a newer write must not interrupt an already admitted persistence write.
 */
export const setCheatAvailabilityAtom = Atom.fn(
	(available: CheatAvailabilitySchema.Type) =>
		writeCheatAvailabilityFx(available).pipe(
			Effect.andThen(applyCheatAvailabilityFx(available)),
		),
	{
		concurrent: true,
	},
).pipe(Atom.setIdleTTL(0));
