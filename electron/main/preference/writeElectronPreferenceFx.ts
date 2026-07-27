import { Effect, FileSystem } from "effect";
import { ElectronMainError } from "../ElectronMainError";

export namespace writeElectronPreferenceFx {
	export interface Props<Value> {
		readonly fileSystem: FileSystem.FileSystem;
		readonly root: string;
		readonly pendingPath: string;
		readonly currentPath: string;
		readonly value: Value;
		readonly operation: string;
		readonly serialize: (value: Value) => string;
	}
}

/** Validates, serializes and atomically replaces one Electron preference file. */
export const writeElectronPreferenceFx = Effect.fn("writeElectronPreferenceFx")(
	<Value>({
		fileSystem,
		root,
		pendingPath,
		currentPath,
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
			yield* fileSystem
				.makeDirectory(root, {
					recursive: true,
				})
				.pipe(
					Effect.andThen(fileSystem.writeFileString(pendingPath, serialized)),
					Effect.andThen(
						fileSystem.rename(pendingPath, currentPath).pipe(
							Effect.ensuring(
								fileSystem
									.remove(pendingPath, {
										force: true,
									})
									.pipe(Effect.ignore),
							),
						),
					),
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
