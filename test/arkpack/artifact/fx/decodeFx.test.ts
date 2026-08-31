import { encode } from "@msgpack/msgpack";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { ArkpackDecodeError } from "~/arkpack/artifact/error/ArkpackDecodeError";
import { Magic } from "~/arkpack/artifact/Magic";
import { decodeFx } from "~/arkpack/artifact/fx/decodeFx";

const createManifestOnlyPackFn = (manifest: Uint8Array) => {
	const headerLength = Magic.byteLength + 4;
	const bytes = new Uint8Array(headerLength + manifest.byteLength);
	bytes.set(Magic);
	new DataView(bytes.buffer).setUint32(Magic.byteLength, manifest.byteLength, true);
	bytes.set(manifest, headerLength);
	return bytes;
};

describe("decodeFx", () => {
	it.each([
		[
			"truncated header",
			new Uint8Array(),
		],
		[
			"invalid MessagePack manifest",
			createManifestOnlyPackFn(
				new Uint8Array([
					0xc1,
				]),
			),
		],
		[
			"schema-invalid manifest",
			createManifestOnlyPackFn(encode({})),
		],
	])("rejects a %s through the typed decode channel", (_, bytes) => {
		const result = Effect.runSync(Effect.result(decodeFx(bytes)));

		expect(result._tag).toBe("Failure");
		if (result._tag === "Failure") {
			expect(result.failure).toBeInstanceOf(ArkpackDecodeError);
			expect(result.failure.message.length).toBeGreaterThan(0);
		}
	});
});
