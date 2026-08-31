import { Effect } from "effect";

import { ArkpackLimits } from "~shared/ArkpackLimits";
import { Magic } from "~/arkpack-artifact/constant/Magic";

export namespace encodeArkpackEnvelopeFx {
	export interface Props {
		readonly payload: Uint8Array;
		readonly proof?: Uint8Array;
	}
}

/** Wraps deterministic compressed gameplay bytes and an optional proof in one Arkpack file. */
export const encodeArkpackEnvelopeFx = Effect.fn("encodeArkpackEnvelopeFx")(
	({ payload, proof = new Uint8Array() }: encodeArkpackEnvelopeFx.Props) =>
		Effect.sync(() => {
			if (payload.byteLength === 0 || payload.byteLength > ArkpackLimits.maxPayloadBytes) {
				throw new Error(
					`Invalid Arkpack payload length ${payload.byteLength}; expected 1-${ArkpackLimits.maxPayloadBytes} bytes.`,
				);
			}
			if (proof.byteLength > ArkpackLimits.maxProofBytes) {
				throw new Error(
					`Arkpack proof exceeds the ${ArkpackLimits.maxProofBytes} byte limit.`,
				);
			}
			const headerLength = Magic.byteLength + 4;
			const output = new Uint8Array(headerLength + payload.byteLength + proof.byteLength);
			output.set(Magic, 0);
			new DataView(output.buffer, output.byteOffset, output.byteLength).setUint32(
				Magic.byteLength,
				payload.byteLength,
				true,
			);
			output.set(payload, headerLength);
			output.set(proof, headerLength + payload.byteLength);
			return output;
		}),
);
