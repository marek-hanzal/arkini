import * as Atom from "effect/unstable/reactivity/Atom";

import { requestApplicationCloseFx } from "~/bridge/lifecycle/requestApplicationCloseFx";

/**
 * Requests the trusted native close handshake.
 * Native controlled-close and final-save authority remain outside React.
 */
export const requestApplicationCloseAtom = Atom.fn((_input: void) => requestApplicationCloseFx(), {
	concurrent: false,
}).pipe(Atom.setIdleTTL(0));
