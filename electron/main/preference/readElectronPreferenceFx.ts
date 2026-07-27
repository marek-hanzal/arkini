import { Effect, FileSystem } from "effect";
import { ElectronMainError } from "../ElectronMainError";

export namespace readElectronPreferenceFx {
	export interface Props<Value> {
		readonly fileSystem: FileSystem.FileSystem;
		readonly path: string;
		readonly fallback: Value;
		readonly operation: string;
		readonly parse: (stored: string) => Value | undefined;
	}
}

/** Reads one optional Electron preference and recovers absent or invalid content to its default. */
export const readElectronPreferenceFx = Effect.fn("readElectronPreferenceFx")(
	<Value>({
		fileSystem,
		path,
		fallback,
		operation,
		parse,
	}: readElectronPreferenceFx.Props<Value>) =>
		fileSystem.readFileString(path).pipe(
			Effect.map((stored) => parse(stored) ?? fallback),
			Effect.catchIf(
				(cause) => cause.reason._tag === "NotFound",
				() => Effect.succeed(fallback),
			),
			Effect.mapError(
				(cause) =>
					new ElectronMainError({
						operation,
						cause,
					}),
			),
		),
);
