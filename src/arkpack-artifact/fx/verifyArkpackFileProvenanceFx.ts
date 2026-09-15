import { bundleFromJSON } from "@sigstore/bundle";
import { createReadStream } from "node:fs";
import { createVerify, X509Certificate } from "node:crypto";
import { Effect } from "effect";

import { ArkpackDistributionChannel } from "~/arkpack-artifact/constant/ArkpackDistributionChannel";
import trustedRootJson from "~/arkpack-artifact/constant/trusted-root.json";
import type { ArkpackProvenanceSchema } from "~/arkpack-artifact/schema/ArkpackProvenanceSchema";
import type { ArkpackFileLayout } from "~/arkpack-artifact/type/ArkpackFileLayout";
import { verifyArkpackProofWithFx } from "./verifyArkpackProvenanceFx";

const verifyPayloadSignatureFx = Effect.fn("verifyPayloadSignatureFx")(
	(layout: ArkpackFileLayout) =>
		Effect.tryPromise({
			try: async () => {
				if (layout.proof === undefined) return false;
				const bundle = bundleFromJSON(
					JSON.parse(
						new TextDecoder("utf-8", {
							fatal: true,
						}).decode(layout.proof),
					),
				);
				if (
					bundle.content?.$case !== "messageSignature" ||
					(bundle.verificationMaterial.content?.$case !== "x509CertificateChain" &&
						bundle.verificationMaterial.content?.$case !== "certificate")
				)
					return false;
				const certificateBytes =
					bundle.verificationMaterial.content.$case === "x509CertificateChain"
						? bundle.verificationMaterial.content.x509CertificateChain.certificates[0]
								?.rawBytes
						: bundle.verificationMaterial.content.certificate.rawBytes;
				if (certificateBytes === undefined) return false;
				const verifier = createVerify("sha256");
				for await (const chunk of createReadStream(layout.arkpackPath, {
					start: layout.payloadOffset,
					end: layout.payloadOffset + layout.payloadLength - 1,
				}))
					verifier.update(chunk as Buffer);
				verifier.end();
				return verifier.verify(
					new X509Certificate(Buffer.from(certificateBytes)).publicKey,
					Buffer.from(bundle.content.messageSignature.signature),
				);
			},
			catch: () => false,
		}),
);

export namespace verifyArkpackFileProvenanceWithFx {
	export interface Props {
		readonly layout: ArkpackFileLayout;
		readonly channel: {
			readonly issuer: string;
			readonly subjectAlternativeName: RegExp;
		};
		readonly trustedRoot: unknown;
	}
}

/** Applies one explicit offline trust policy to a payload streamed from disk. */
export const verifyArkpackFileProvenanceWithFx = Effect.fn("verifyArkpackFileProvenanceWithFx")(
	function* ({ layout, channel, trustedRoot }: verifyArkpackFileProvenanceWithFx.Props) {
		if (layout.proof === undefined)
			return {
				type: "community",
			} satisfies ArkpackProvenanceSchema.Type;
		return yield* verifyArkpackProofWithFx({
			artifactSignatureVerified: yield* verifyPayloadSignatureFx(layout),
			proof: layout.proof,
			channel,
			trustedRoot,
		});
	},
);

/** Offline-classifies a proof while streaming the signed payload from disk. */
export const verifyArkpackFileProvenanceFx = Effect.fn("verifyArkpackFileProvenanceFx")(
	(layout: ArkpackFileLayout) =>
		verifyArkpackFileProvenanceWithFx({
			layout,
			channel: ArkpackDistributionChannel,
			trustedRoot: trustedRootJson,
		}),
);
