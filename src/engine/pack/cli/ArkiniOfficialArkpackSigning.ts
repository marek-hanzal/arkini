import { ArkiniOfficialArkpackIdentity } from "../../../../shared/ArkiniOfficialArkpackIdentity";

/** Canonical build inputs for the currently active official Arkini signing identity. */
export const ArkiniOfficialArkpackSigning = {
	keyId: ArkiniOfficialArkpackIdentity.keyId,
	privateKeyPath: ".arkini/arkpack-private.pem",
	trustedKeysPath: "game/arkini.arkpack.keys.json",
} as const;
