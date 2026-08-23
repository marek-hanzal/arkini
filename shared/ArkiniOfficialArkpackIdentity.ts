import { ArkiniDefaultPackageId } from "./ArkiniAppMetadata";

/** Source-owned identity used by official signing. */
export const ArkiniOfficialArkpackIdentity = {
	packageId: ArkiniDefaultPackageId,
	version: "1.0",
	keyId: "arkini-official-2026-01",
} as const;
