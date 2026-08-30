import { Effect } from "effect";
import type { FilesystemWrite } from "~/filesystem-write/service/FilesystemWrite";
import { ElectronMainError } from "../ElectronMainError";

const encoder = new TextEncoder();

export namespace writeElectronPreferenceFx {
	export interface Props<Value> {
		readonly filesystemWrite: FilesystemWrite;
		readonly lock: string;
		readonly target: string;
		readonly value: Value;
		readonly operation: string;
		readonly serialize: (value: Value) => string;
	}
}

/** Validates, serializes and atomically replaces one Electron preference file. */
export const writeElectronPreferenceFx = Effect.fn("writeElectronPreferenceFx")(
	<Value>({
		filesystemWrite,
		lock,
		target,
		value,
		operation,
		serialize,
	}: writeElectronPreferenceFx.Props<Value>) =>
		Effect.gen(function* () {
			const serialized = yield* Effect.try({
				try: () => serialize(value),
				catch: (cause) =>
					new ElectronMainError({
						operation,
						cause,
					}),
			});
			yield* filesystemWrite
				.replaceFileFx({
					lock,
					target,
					bytes: encoder.encode(serialized),
				})
				.pipe(
					Effect.mapError(
						(cause) =>
							new ElectronMainError({
								operation,
								cause,
							}),
					),
				);
		}),
);
