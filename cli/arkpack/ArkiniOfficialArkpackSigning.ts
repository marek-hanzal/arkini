/** Canonical build inputs for the currently active official Arkini signing identity. */
export const ArkiniOfficialArkpackSigning = {
	keyId: "arkini-official-2026-01",
	metadataOutput: "game/arkini.game.arkpack.metadata.json",
	packageId: "arkini",
	privateKeyPath: ".arkini/arkpack-private.pem",
	trustedKeysPath: "game/arkini.arkpack.keys.json",
} as const;
