/** Fixed resource limits enforced before IPC transfer and during package decoding. */
export const ArkpackLimits = {
	maxPayloadBytes: 128 * 1024 * 1024,
	maxProofBytes: 64 * 1024,
	maxArkpackBytes: 128 * 1024 * 1024 + 64 * 1024 + 11,
	maxCatalogBytes: 512 * 1024 * 1024,
	maxCatalogCandidates: 512,
	maxDecodedBytes: 256 * 1024 * 1024,
} as const;
