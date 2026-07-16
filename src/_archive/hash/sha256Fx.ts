import { Effect } from "effect";

export const sha256Fx = Effect.fn("sha256Fx")(function* (input: string | Uint8Array) {
	const encoded = typeof input === "string" ? new TextEncoder().encode(input) : input;
	const buffer = encoded.buffer.slice(
		encoded.byteOffset,
		encoded.byteOffset + encoded.byteLength,
	) as ArrayBuffer;
	const digest = yield* Effect.promise(() => crypto.subtle.digest("SHA-256", buffer));

	return [
		...new Uint8Array(digest),
	]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
});
