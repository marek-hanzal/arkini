import { Effect } from "effect";
import type { ArkpackStorage } from "~/arkpack/renderer/ArkpackStorage";
import { ArkpackStorageError } from "~/arkpack/renderer/ArkpackStorageError";

export namespace createElectronArkpackStorageFx {
	export interface Props {
		readonly api?: Window["arkini"]["arkpack"];
	}
}

/** Adapts the typed preload Promise transport once into an Effect-native Arkpack capability. */
export const createElectronArkpackStorageFx = Effect.fn("createElectronArkpackStorageFx")(
	({ api = window.arkini.arkpack }: createElectronArkpackStorageFx.Props = {}) =>
		Effect.succeed({
			listFx: Effect.tryPromise({
				try: () => api.list(),
				catch: (cause) =>
					new ArkpackStorageError({
						operation: "list",
						cause,
					}),
			}).pipe(
				Effect.map((files) =>
					files.map((file) => ({
						...file,
						bytes: file.bytes.slice().buffer,
					})),
				),
			),
			readFx: Effect.fn("ArkpackStorage.readFx")((packageId: string) =>
				Effect.tryPromise({
					try: () => api.read(packageId),
					catch: (cause) =>
						new ArkpackStorageError({
							operation: "read",
							cause,
						}),
				}).pipe(
					Effect.map((records) =>
						records.map((record) => ({
							...record,
							bytes: record.bytes.slice().buffer,
						})),
					),
				),
			),
			removeFx: Effect.fn("ArkpackStorage.removeFx")((packageId: string) =>
				Effect.tryPromise({
					try: () => api.remove(packageId),
					catch: (cause) =>
						new ArkpackStorageError({
							operation: "remove",
							cause,
						}),
				}),
			),
			writeFx: Effect.fn("ArkpackStorage.writeFx")((packageId: string, bytes: ArrayBuffer) =>
				Effect.tryPromise({
					try: () =>
						api.install({
							packageId,
							bytes: new Uint8Array(bytes.slice(0)),
						}),
					catch: (cause) =>
						new ArkpackStorageError({
							operation: "install",
							cause,
						}),
				}),
			),
			openUserDirectoryFx: Effect.tryPromise({
				try: () => api.openUserDirectory(),
				catch: (cause) =>
					new ArkpackStorageError({
						operation: "open-user-directory",
						cause,
					}),
			}),
		} satisfies ArkpackStorage),
);
