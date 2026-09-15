import { Effect } from "effect";

import { ArkpackDecodeError } from "~/arkpack-artifact/error/ArkpackDecodeError";
import { ManifestSchema } from "~/arkpack-artifact/schema/ManifestSchema";
import { PayloadSchema } from "~/arkpack-artifact/schema/PayloadSchema";
import { admitArkiniVersionFx } from "~/application-version/fx/admitArkiniVersionFx";
import { ArkpackLimits } from "~shared/ArkpackLimits";

export const decodeFx = Effect.fn("decodeFx")(function* (bytes: Uint8Array) {
	const payload = yield* Effect.try({
		try: () => {
			const decoder = new TextDecoder("utf-8", {
				fatal: true,
			});
			const headerLength = 4;
			if (bytes.byteLength < headerLength) {
				throw new Error("Invalid pack: truncated header.");
			}
			const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
			const manifestLength = view.getUint32(0, true);
			if (manifestLength === 0 || manifestLength > ArkpackLimits.maxManifestBytes)
				throw new Error(`Invalid pack manifest length ${manifestLength}.`);
			const manifestEnd = headerLength + manifestLength;
			if (bytes.byteLength < manifestEnd) {
				throw new Error("Invalid pack: truncated manifest.");
			}

			const manifest = ManifestSchema.parse(
				JSON.parse(decoder.decode(bytes.slice(headerLength, manifestEnd))),
			);
			if (manifest.length > ArkpackLimits.maxConfigBytes)
				throw new Error(`Invalid pack config length ${manifest.length}.`);
			const configEnd = manifestEnd + manifest.length;
			if (bytes.byteLength < configEnd) {
				throw new Error("Invalid pack: truncated config.");
			}
			const config = JSON.parse(decoder.decode(bytes.slice(manifestEnd, configEnd)));

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
					mime: resource.mime,
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
