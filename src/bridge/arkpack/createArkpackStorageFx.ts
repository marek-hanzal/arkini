import { Effect } from "effect";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { invokeArkpackTransportFx } from "~/bridge/arkpack/invokeArkpackTransportFx";

export namespace createArkpackStorageFx {
	export interface Props {
		readonly api?: Window["arkini"]["arkpack"];
	}
}

/** Adapts the typed preload Promise transport once into an Effect-native Arkpack capability. */
export const createArkpackStorageFx = Effect.fn("createArkpackStorageFx")(
	({ api = window.arkini.arkpack }: createArkpackStorageFx.Props = {}) =>
		Effect.succeed({
			listFx: invokeArkpackTransportFx("list", () => api.list()).pipe(
				Effect.map((files) =>
					files.map((file) => ({
						...file,
						bytes: file.bytes.slice().buffer,
					})),
				),
			),
			readFx: Effect.fn("ArkpackStorage.readFx")((packageId: string) =>
				invokeArkpackTransportFx("read", () => api.read(packageId)).pipe(
					Effect.map((records) =>
						records.map((record) => ({
							...record,
							bytes: record.bytes.slice().buffer,
						})),
					),
				),
			),
			removeFx: Effect.fn("ArkpackStorage.removeFx")((packageId: string) =>
				invokeArkpackTransportFx("remove", () => api.remove(packageId)),
			),
			writeFx: Effect.fn("ArkpackStorage.writeFx")((packageId: string, bytes: ArrayBuffer) =>
				invokeArkpackTransportFx("install", () =>
					api.install({
						packageId,
						bytes: new Uint8Array(bytes.slice(0)),
					}),
				),
			),
			openUserDirectoryFx: invokeArkpackTransportFx("open-user-directory", () =>
				api.openUserDirectory(),
			),
		} satisfies ArkpackStorage),
);
