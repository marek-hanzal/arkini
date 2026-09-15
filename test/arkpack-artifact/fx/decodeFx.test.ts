import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { ArkpackDecodeError } from "~/arkpack-artifact/error/ArkpackDecodeError";
import { decodeFx } from "~/arkpack-artifact/fx/decodeFx";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";

const createManifestOnlyPackFn = (manifest: Uint8Array) => {
	const headerLength = 4;
	const bytes = new Uint8Array(headerLength + manifest.byteLength);
	new DataView(bytes.buffer).setUint32(0, manifest.byteLength, true);
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
			"invalid JSON manifest",
			createManifestOnlyPackFn(
				new Uint8Array([
					0xc1,
				]),
			),
		],
		[
			"schema-invalid manifest",
			createManifestOnlyPackFn(new TextEncoder().encode(JSON.stringify({}))),
		],
		[
			"manifest resource outside the canonical MIME contract",
			createManifestOnlyPackFn(
				new TextEncoder().encode(
					JSON.stringify({
						version: "1.0",
						arkini: ArkiniAppVersion,
						length: 0,
						resources: [
							{
								id: "hostile-resource",
								mime: "text/html",
								length: 0,
							},
						],
					}),
				),
			),
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
