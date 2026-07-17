import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";

/** Explicit test double; never selected by product runtime. */
export class InMemoryArkpackStorage implements ArkpackStorage {
	readonly #records = new Map<string, ArkpackStorage.LoadedRecord>();

	close = () => undefined;
	list = async () =>
		Array.from(this.#records.values(), ({ descriptor }) => descriptor).sort(
			(left, right) =>
				(right.importedAtMs ?? 0) - (left.importedAtMs ?? 0) ||
				left.packageId.localeCompare(right.packageId),
		);
	read = async (packageId: string) => {
		const record = this.#records.get(packageId);
		return record === undefined
			? undefined
			: {
					descriptor: record.descriptor,
					bytes: record.bytes.slice(0),
				};
	};
	remove = async (packageId: string) => {
		this.#records.delete(packageId);
	};
	write = async (descriptor: ArkpackDescriptor, bytes: ArrayBuffer) => {
		this.#records.set(descriptor.packageId, {
			descriptor,
			bytes: bytes.slice(0),
		});
	};
}
