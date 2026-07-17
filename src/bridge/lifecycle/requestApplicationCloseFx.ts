import { Effect } from "effect";

/** Requests the trusted native close handshake and fails only when renderer shutdown is rejected. */
export const requestApplicationCloseFx = Effect.fn("requestApplicationCloseFx")(() =>
	Effect.tryPromise({
		try: () => window.arkini.lifecycle.requestClose(),
		catch: (cause) => cause,
	}),
);
