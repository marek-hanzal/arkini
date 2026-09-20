import { Effect } from "effect";
import type { SerapackStorage } from "~/serapack-catalog/service/SerapackStorage";
import { SerapackStorageError } from "~/serapack-catalog/error/SerapackStorageError";

export namespace createElectronSerapackStorageFx {
	export interface Props {
		readonly api?: Window["serakki"]["serapack"];
	}
}

/** Adapts the typed preload Promise transport once into an Effect-native Serapack capability. */
export const createElectronSerapackStorageFx = Effect.fn("createElectronSerapackStorageFx")(
	({ api = window.serakki.serapack }: createElectronSerapackStorageFx.Props = {}) =>
		Effect.succeed({
			listFx: Effect.tryPromise({
				try: () => api.listFn(),
				catch: (cause) =>
					new SerapackStorageError({
						operation: "list",
						cause,
					}),
			}),
			readFx: Effect.fn("SerapackStorage.readFx")((packageId: string) =>
				Effect.tryPromise({
					try: () => api.readFn(packageId),
					catch: (cause) =>
						new SerapackStorageError({
							operation: "read",
							cause,
						}),
				}),
			),
			removeFx: Effect.fn("SerapackStorage.removeFx")((packageId: string) =>
				Effect.tryPromise({
					try: () => api.removeFn(packageId),
					catch: (cause) =>
						new SerapackStorageError({
							operation: "remove",
							cause,
						}),
				}),
			),
			importFx: Effect.tryPromise({
				try: () => api.importFn(),
				catch: (cause) =>
					new SerapackStorageError({
						operation: "install",
						cause,
					}),
			}),
			installEditorBuildFx: Effect.fn("SerapackStorage.installEditorBuildFx")((record) =>
				Effect.tryPromise({
					try: () => api.installEditorBuildFn(record),
					catch: (cause) =>
						new SerapackStorageError({
							operation: "install",
							cause,
						}),
				}),
			),
			openUserDirectoryFx: Effect.tryPromise({
				try: () => api.openUserDirectoryFn(),
				catch: (cause) =>
					new SerapackStorageError({
						operation: "open-user-directory",
						cause,
					}),
			}),
		} satisfies SerapackStorage),
);
