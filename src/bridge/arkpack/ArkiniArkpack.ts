import ArkiniGamePackMetadata from "../../../game/arkini.game.arkpack.metadata.json";
import ArkiniGamePackUrl from "../../../game/arkini.game.arkpack?url";

import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import { ArkpackMetadataSchema } from "~/engine/pack/schema/ArkpackMetadataSchema";

const metadata = ArkpackMetadataSchema.parse(ArkiniGamePackMetadata);

/** Stable launcher identity, metadata and bundled binary URL for the official Arkini package. */
export const ArkiniArkpack = {
	packageId: metadata.packageId,
	url: ArkiniGamePackUrl,
	descriptor: {
		packageId: metadata.packageId,
		contentHash: metadata.contentHash,
		gameId: metadata.gameId,
		title: metadata.title,
		configVersion: metadata.configVersion,
		compressedSize: metadata.compressedSize,
		source: "built-in",
	} satisfies ArkpackDescriptor,
} as const;
