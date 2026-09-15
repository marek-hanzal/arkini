import { Effect } from "effect";

import { PayloadSchema } from "~/arkpack-artifact/schema/PayloadSchema";
import { ArkpackLimits } from "~shared/ArkpackLimits";

export const encodeFx = Effect.fn("encodeFx")(function* (payload: PayloadSchema.Type) {
	return yield* Effect.sync(() => {
		const { version, arkini, config, resources } = PayloadSchema.parse(payload);
		const encoder = new TextEncoder();
		const configBytes = encoder.encode(JSON.stringify(config));
		if (configBytes.byteLength > ArkpackLimits.maxConfigBytes)
			throw new Error(
				`Arkpack config exceeds the ${ArkpackLimits.maxConfigBytes} byte limit.`,
			);
		const manifestBytes = encoder.encode(
			JSON.stringify({
				version,
				arkini,
				length: configBytes.byteLength,
				resources: resources.map((resource) => ({
					id: resource.id,
					mime: resource.mime,
					length: resource.bytes.byteLength,
				})),
			}),
		);
		if (manifestBytes.byteLength > ArkpackLimits.maxManifestBytes)
			throw new Error(
				`Arkpack manifest exceeds the ${ArkpackLimits.maxManifestBytes} byte limit.`,
			);
		const headerLength = 4;
		const output = new Uint8Array(
			headerLength +
				manifestBytes.byteLength +
				configBytes.byteLength +
				resources.reduce((length, resource) => length + resource.bytes.byteLength, 0),
		);
		const view = new DataView(output.buffer, output.byteOffset, output.byteLength);

		view.setUint32(0, manifestBytes.byteLength, true);

		let offset = headerLength;
		output.set(manifestBytes, offset);
		offset += manifestBytes.byteLength;
		output.set(configBytes, offset);
		offset += configBytes.byteLength;

		for (const resource of resources) {
			output.set(resource.bytes, offset);
			offset += resource.bytes.byteLength;
		}

		return output;
	});
});
