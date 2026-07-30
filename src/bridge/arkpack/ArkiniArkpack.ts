import ArkiniGamePackMetadata from "../../../game/arkini.game.arkpack.metadata.json";
import ArkiniGamePackSignatureSource from "../../../game/arkini.game.arkpack.sig?raw";
import ArkiniGamePackSignatureUrl from "../../../game/arkini.game.arkpack.sig?url&no-inline";
import ArkiniGamePackUrl from "../../../game/arkini.game.arkpack?url";

import type { BuiltInArkpack } from "~/bridge/arkpack/BuiltInArkpack";
import { ArkpackMetadataSchema } from "~/engine/pack/schema/ArkpackMetadataSchema";
import { ArkpackSignatureSchema } from "~/engine/pack/schema/ArkpackSignatureSchema";

const metadata = ArkpackMetadataSchema.parse(ArkiniGamePackMetadata);
const signature = ArkpackSignatureSchema.parse(
	JSON.parse(ArkiniGamePackSignatureSource) as unknown,
);

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
		game: metadata.game,
		trust: {
			type: "official",
			keyId: signature.keyId,
		},
		source: "built-in",
	},
} as const satisfies BuiltInArkpack;
