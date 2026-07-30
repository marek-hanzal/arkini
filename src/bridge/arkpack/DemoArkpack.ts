import DemoGamePackMetadata from "../../../game/demo.game.arkpack.metadata.json";
import DemoGamePackUrl from "../../../game/demo.game.arkpack?url";

import type { BuiltInArkpack } from "~/bridge/arkpack/BuiltInArkpack";
import { ArkpackMetadataSchema } from "~/engine/pack/schema/ArkpackMetadataSchema";

const metadata = ArkpackMetadataSchema.parse(DemoGamePackMetadata);

/** Bundled unsigned game used to exercise the external-content path without producer complexity. */
export const DemoArkpack = {
	packageId: metadata.packageId,
	url: DemoGamePackUrl,
	descriptor: {
		packageId: metadata.packageId,
		hash: metadata.hash,
		gameId: metadata.gameId,
		title: metadata.title,
		game: metadata.game,
		trust: {
			type: "external",
			reason: "unsigned",
		},
		source: "built-in",
	},
} as const satisfies BuiltInArkpack;
