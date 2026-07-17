/** Fixed resource limits shared by renderer import preflight and binary package validation. */
export const ArkpackLimits = {
	maxCompressedBytes: 64 * 1024 * 1024,
	maxDecodedBytes: 256 * 1024 * 1024,
} as const;
