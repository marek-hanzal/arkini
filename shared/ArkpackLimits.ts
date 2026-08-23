/** Fixed resource limits enforced before IPC transfer and during package decoding. */
export const ArkpackLimits = {
	maxCompressedBytes: 64 * 1024 * 1024,
	maxCatalogBytes: 512 * 1024 * 1024,
	maxCatalogCandidates: 512,
	maxDecodedBytes: 256 * 1024 * 1024,
	maxSignatureBytes: 16 * 1024,
} as const;
