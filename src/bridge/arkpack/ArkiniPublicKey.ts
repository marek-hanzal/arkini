import { ArkiniBuiltPublicKey } from "~/engine/pack/ArkiniBuiltPublicKey";
import { ArkpackPublicKeySchema } from "~/engine/pack/schema/ArkpackPublicKeySchema";

/** The only public key trusted by this Arkini application build. */
export const ArkiniPublicKey = ArkpackPublicKeySchema.parse(ArkiniBuiltPublicKey);
