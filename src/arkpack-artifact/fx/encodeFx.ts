import { encode } from "@msgpack/msgpack";
import { Effect } from "effect";

import { Magic } from "~/arkpack-artifact/constant/Magic";
import { PayloadSchema } from "~/arkpack-artifact/schema/PayloadSchema";

export const encodeFx = Effect.fn("encodeFx")(function* (payload: PayloadSchema.Type) {
	return yield* Effect.sync(() => {
		const { version, arkini, config, resources } = PayloadSchema.parse(payload);
		const configBytes = encode(config);
		const manifestBytes = encode({
			version,
			arkini,
			length: configBytes.byteLength,
			resources: resources.map((resource) => ({
				id: resource.id,
				length: resource.bytes.byteLength,
			})),
		});
		const headerLength = Magic.byteLength + 4;
		const output = new Uint8Array(
			headerLength +
				manifestBytes.byteLength +
				configBytes.byteLength +
				resources.reduce((length, resource) => length + resource.bytes.byteLength, 0),
		);
		const view = new DataView(output.buffer, output.byteOffset, output.byteLength);

		output.set(Magic, 0);
		view.setUint32(Magic.byteLength, manifestBytes.byteLength, true);

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
