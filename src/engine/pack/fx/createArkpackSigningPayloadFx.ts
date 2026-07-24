import { Effect } from "effect";

const domain = new TextEncoder().encode("arkini:arkpack:v1\0");

/** Prefixes exact final Arkpack bytes with the canonical version-1 signing domain. */
export const createArkpackSigningPayloadFx = Effect.fn("createArkpackSigningPayloadFx")(
	(bytes: Uint8Array) =>
		Effect.sync(() => {
			const payload = new Uint8Array(domain.byteLength + bytes.byteLength);
			payload.set(domain, 0);
			payload.set(bytes, domain.byteLength);
			return payload;
		}),
);
