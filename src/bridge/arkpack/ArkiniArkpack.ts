import ArkiniGamePackMetadata from "../../../game/arkini.game.arkpack.metadata.json";
import ArkiniGamePackSignatureUrl from "../../../game/arkini.game.arkpack.sig?url";
import ArkiniGamePackUrl from "../../../game/arkini.game.arkpack?url";

import type { BuiltInArkpack } from "~/bridge/arkpack/BuiltInArkpack";
import { ArkpackMetadataSchema } from "~/engine/pack/schema/ArkpackMetadataSchema";

const metadata = ArkpackMetadataSchema.parse(ArkiniGamePackMetadata);

/** Stable launcher identity, metadata and bundled binary URL for the official Arkini package. */
export const ArkiniArkpack = {
	packageId: metadata.packageId,
	url: ArkiniGamePackUrl,
	signatureUrl: ArkiniGamePackSignatureUrl,
	descriptor: {
		packageId: metadata.packageId,
		contentHash: metadata.contentHash,
		gameId: metadata.gameId,
		title: metadata.title,
		configVersion: metadata.configVersion,
		compressedSize: metadata.compressedSize,
		trust: {
			type: "official",
			keyId: "arkini-official-2026-01",
		},
		source: "built-in",
	},
} as const satisfies BuiltInArkpack;
