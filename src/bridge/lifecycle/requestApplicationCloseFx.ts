import { Effect } from "effect";

/** Requests the trusted native close handshake; final-save failure does not keep the window open. */
export const requestApplicationCloseFx = Effect.fn("requestApplicationCloseFx")(() =>
	Effect.tryPromise({
		try: () => window.arkini.lifecycle.requestClose(),
		catch: (cause) => cause,
	}),
);
