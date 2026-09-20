import { Effect } from "effect";

export const openDiagnosticDirectoryFx = Effect.fn("openDiagnosticDirectoryFx")(() =>
	Effect.tryPromise({
		try: () => window.serakki.diagnostics.openDirectoryFn(),
		catch: (cause) => cause,
	}),
);
