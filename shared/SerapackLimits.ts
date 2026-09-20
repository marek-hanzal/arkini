/** Fixed allocation and catalog limits enforced at every Serapack admission boundary. */
export const SerapackLimits = {
	maxPayloadBytes: 128 * 1024 * 1024,
	maxProofBytes: 64 * 1024,
	maxSerapackBytes: 128 * 1024 * 1024 + 64 * 1024 + 11,
	maxManifestBytes: 4 * 1024 * 1024,
	maxConfigBytes: 32 * 1024 * 1024,
	maxCatalogBytes: 512 * 1024 * 1024,
	maxCatalogCandidates: 512,
} as const;
