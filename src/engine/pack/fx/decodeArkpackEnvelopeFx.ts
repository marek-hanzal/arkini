import { Effect } from "effect";

import { ArkpackLimits } from "../../../../shared/ArkpackLimits";
import { Magic } from "~/engine/pack/Magic";

/** Splits one self-contained Arkpack without interpreting its optional proof. */
export const decodeArkpackEnvelopeFx = Effect.fn("decodeArkpackEnvelopeFx")((bytes: Uint8Array) =>
	Effect.try({
		try: () => {
			if (bytes.byteLength > ArkpackLimits.maxArkpackBytes) {
				throw new Error(`Arkpack exceeds the ${ArkpackLimits.maxArkpackBytes} byte limit.`);
			}
			const headerLength = Magic.byteLength + 4;
			if (bytes.byteLength < headerLength)
				throw new Error("Invalid Arkpack: truncated envelope.");
			if (!Magic.every((byte, index) => bytes[index] === byte)) {
				throw new Error("Invalid Arkpack: envelope magic mismatch.");
			}
			const payloadLength = new DataView(
				bytes.buffer,
				bytes.byteOffset,
				bytes.byteLength,
			).getUint32(Magic.byteLength, true);
			if (payloadLength === 0 || payloadLength > ArkpackLimits.maxPayloadBytes) {
				throw new Error(`Invalid Arkpack payload length ${payloadLength}.`);
			}
			const payloadEnd = headerLength + payloadLength;
			if (payloadEnd > bytes.byteLength)
				throw new Error("Invalid Arkpack: truncated payload.");
			const proofLength = bytes.byteLength - payloadEnd;
			return {
				payload: bytes.slice(headerLength, payloadEnd),
				...(proofLength === 0 || proofLength > ArkpackLimits.maxProofBytes
					? {}
					: {
							proof: bytes.slice(payloadEnd),
						}),
			} as const;
		},
		catch: (cause) => (cause instanceof Error ? cause : new Error("Invalid Arkpack envelope.")),
	}),
);
