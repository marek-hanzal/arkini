import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { ArkpackStorageError } from "~/bridge/arkpack/ArkpackStorageError";

const execute = async <Value>(
	operation: ArkpackStorageError["operation"],
	call: () => Promise<Value>,
): Promise<Value> => {
	try {
		return await call();
	} catch (cause) {
		throw new ArkpackStorageError({
			operation,
			cause,
		});
	}
};

/** Renderer adapter for the narrow Electron Arkpack filesystem capability. */
export class DesktopArkpackStorage implements ArkpackStorage {
	readonly #api: NonNullable<Window["arkini"]>["arkpack"];

	constructor(api = window.arkini.arkpack) {
		this.#api = api;
	}

	close = () => undefined;
	list = () => execute("list", () => this.#api.list());
	read = async (packageId: string) => {
		const record = await execute("read", () => this.#api.read(packageId));
		if (record === null) return undefined;
		return {
			descriptor: record.descriptor,
			bytes: record.bytes.slice().buffer,
		};
	};
	remove = (packageId: string) => execute("remove", () => this.#api.remove(packageId));
	write = (descriptor: Parameters<ArkpackStorage["write"]>[0], bytes: ArrayBuffer) =>
		execute("install", () =>
			this.#api.install({
				descriptor: {
					...descriptor,
					source: "imported",
				},
				bytes: new Uint8Array(bytes.slice(0)),
			}),
		);
}
