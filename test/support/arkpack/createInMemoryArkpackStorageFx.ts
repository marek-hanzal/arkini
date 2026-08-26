import { Effect } from "effect";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";

/** Creates an explicit in-memory Arkpack capability for tests only. */
export const createInMemoryArkpackStorageFx = Effect.fn("createInMemoryArkpackStorageFx")(() =>
	Effect.sync(() => {
		const files = new Map<string, ArkpackStorage.File>();
		return {
			listFx: Effect.sync(() =>
				Array.from(files.values(), (file) => ({
					...file,
					bytes: file.bytes.slice(0),
				})).sort((left, right) => left.packageId.localeCompare(right.packageId)),
			),
			readFx: (packageId) =>
				Effect.sync(() => {
					const file = files.get(packageId);
					return file === undefined
						? []
						: [
								{
									...file,
									bytes: file.bytes.slice(0),
								},
							];
				}),
			removeFx: (packageId) =>
				Effect.sync(() => {
					files.delete(packageId);
				}),
			writeFx: (packageId, bytes) =>
				Effect.sync(() => {
					files.set(packageId, {
						packageId,
						filename: `${encodeURIComponent(packageId)}.arkpack`,
						bytes: bytes.slice(0),
						source: "user",
						overridesBundled: false,
					});
				}),
			openUserDirectoryFx: Effect.void,
		} satisfies ArkpackStorage;
	}),
);
