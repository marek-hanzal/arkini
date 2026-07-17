import { Effect } from "effect";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";

/** Creates an explicit in-memory Arkpack capability for tests only. */
export const createInMemoryArkpackStorageFx = Effect.fn("createInMemoryArkpackStorageFx")(() =>
	Effect.sync(() => {
		const records = new Map<string, ArkpackStorage.LoadedRecord>();
		return {
			listFx: Effect.sync(() =>
				Array.from(records.values(), ({ descriptor }) => descriptor).sort(
					(left, right) =>
						(right.importedAtMs ?? 0) - (left.importedAtMs ?? 0) ||
						left.packageId.localeCompare(right.packageId),
				),
			),
			readFx: (packageId) =>
				Effect.sync(() => {
					const record = records.get(packageId);
					return record === undefined
						? undefined
						: {
								descriptor: record.descriptor,
								bytes: record.bytes.slice(0),
							};
				}),
			removeFx: (packageId) =>
				Effect.sync(() => {
					records.delete(packageId);
				}),
			writeFx: (descriptor, bytes) =>
				Effect.sync(() => {
					records.set(descriptor.packageId, {
						descriptor,
						bytes: bytes.slice(0),
					});
				}),
		} satisfies ArkpackStorage;
	}),
);
