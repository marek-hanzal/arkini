import { decode } from "@msgpack/msgpack";
import { Effect } from "effect";

import { ArkpackDecodeError } from "~/arkpack/artifact/error/ArkpackDecodeError";
import { Magic } from "~/arkpack/artifact/Magic";
import { ManifestSchema } from "~/arkpack/artifact/schema/ManifestSchema";
import { PayloadSchema } from "~/arkpack/artifact/schema/PayloadSchema";
import { admitArkiniVersionFx } from "~/engine/version/ArkiniVersionAdmission";

export const decodeFx = Effect.fn("decodeFx")(function* (bytes: Uint8Array) {
	const payload = yield* Effect.try({
		try: () => {
			const headerLength = Magic.byteLength + 4;
			if (bytes.byteLength < headerLength) {
				throw new Error("Invalid pack: truncated header.");
			}
			if (!Magic.every((byte, index) => bytes[index] === byte)) {
				throw new Error("Invalid pack: magic header mismatch.");
			}

			const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
			const manifestLength = view.getUint32(Magic.byteLength, true);
			const manifestEnd = headerLength + manifestLength;
			if (bytes.byteLength < manifestEnd) {
				throw new Error("Invalid pack: truncated manifest.");
			}

			const manifest = ManifestSchema.parse(decode(bytes.slice(headerLength, manifestEnd)));
			const configEnd = manifestEnd + manifest.length;
			if (bytes.byteLength < configEnd) {
				throw new Error("Invalid pack: truncated config.");
			}
			const config = decode(bytes.slice(manifestEnd, configEnd));

			let offset = configEnd;
			const resources = manifest.resources.map((resource) => {
				const end = offset + resource.length;
				if (bytes.byteLength < end) {
					throw new Error(`Invalid pack: truncated resource ${resource.id}.`);
				}
				const resourceBytes = bytes.slice(offset, end);
				offset = end;

				return {
					id: resource.id,
					mime: "image/png",
					bytes: resourceBytes,
				};
			});

			if (offset !== bytes.byteLength) {
				throw new Error(`Invalid pack: trailing ${bytes.byteLength - offset} bytes.`);
			}

			return PayloadSchema.parse({
				version: manifest.version,
				arkini: manifest.arkini,
				config,
				resources,
			});
		},
		catch: (cause) =>
			new ArkpackDecodeError({
				message: cause instanceof Error ? cause.message : "Invalid Arkpack payload.",
				cause,
			}),
	});
	yield* admitArkiniVersionFx("Arkpack", payload.arkini);
	return payload;
});
