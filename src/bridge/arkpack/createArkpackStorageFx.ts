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
			listFx: invokeArkpackTransportFx("list", () => api.list()),
			readFx: (packageId) =>
				invokeArkpackTransportFx("read", () => api.read(packageId)).pipe(
					Effect.map((record) =>
						record === null
							? undefined
							: {
									descriptor: record.descriptor,
									bytes: record.bytes.slice().buffer,
								},
					),
				),
			removeFx: (packageId) =>
				invokeArkpackTransportFx("remove", () => api.remove(packageId)),
			writeFx: (descriptor, bytes) =>
				invokeArkpackTransportFx("install", () =>
					api.install({
						descriptor: {
							...descriptor,
							source: "imported",
						},
						bytes: new Uint8Array(bytes.slice(0)),
					}),
				),
		} satisfies ArkpackStorage),
);
