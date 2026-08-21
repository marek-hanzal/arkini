import { Effect } from "effect";

export const openDiagnosticDirectoryFx = Effect.fn("openDiagnosticDirectoryFx")(() =>
	Effect.tryPromise({
		try: () => window.arkini.diagnostics.openDirectory(),
		catch: (cause) => cause,
	}),
);
