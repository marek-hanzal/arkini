import { createPrivateKey, createPublicKey } from "node:crypto";

import { ArkpackPublicKeySchema } from "../schema/ArkpackPublicKeySchema";
import { ArkpackSignKeySchema } from "../schema/ArkpackSignKeySchema";

/** Derives the one distributable SPKI public key from an explicit signing secret. */
export const deriveArkpackPublicKey = (candidate: string) => {
	const signKey = ArkpackSignKeySchema.parse(candidate.trim());
	const privateKey = createPrivateKey(Buffer.from(signKey, "base64").toString("utf8"));
	const publicKey = createPublicKey(privateKey)
		.export({
			format: "der",
			type: "spki",
		})
		.toString("base64");
	return ArkpackPublicKeySchema.parse(publicKey);
};
