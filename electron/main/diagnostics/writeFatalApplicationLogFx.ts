import { Effect } from "effect";

import { formatApplicationDiagnosticTextFn } from "~/application-diagnostics/fn/formatApplicationDiagnosticTextFn";

import { createDiagnosticLogFx } from "./createDiagnosticLogFx";

export namespace writeFatalApplicationLogFx {
	export interface Props {
		readonly directoryPath: string;
		readonly error: unknown;
	}
}

/** Reopens the common root when the main Effect fails outside its owned log lifetime. */
export const writeFatalApplicationLogFx = Effect.fn("writeFatalApplicationLogFx")(
	({ directoryPath, error }: writeFatalApplicationLogFx.Props) =>
		Effect.gen(function* () {
			const diagnostics = yield* createDiagnosticLogFx(directoryPath);
			yield* diagnostics
				.writeApplicationFx({
					level: "fatal",
					message: "Application lifecycle failed",
					body: formatApplicationDiagnosticTextFn({
						value: error,
					}),
				})
				.pipe(Effect.ensuring(diagnostics.closeFx.pipe(Effect.catch(() => Effect.void))));
		}),
);
