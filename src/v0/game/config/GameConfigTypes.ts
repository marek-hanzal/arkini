import type { z } from "zod";
import type { AssetSchema } from "~/v0/game/config/schema/GameAssetSchema";
import type { GameMetaSchema } from "~/v0/game/config/schema/GameMetaSchema";
import type { ItemSchema } from "~/v0/game/config/schema/GameItemSchema";
import type { ResourceSchema } from "~/v0/game/config/schema/GameResourceSchema";
import type { StartingStateSchema } from "~/v0/game/config/schema/GameStartingStateSchema";

export type GameConfig = {
	version: 1;
	game: z.infer<typeof GameMetaSchema>;
	resources: Record<string, z.infer<typeof ResourceSchema>>;
	assets: Record<string, z.infer<typeof AssetSchema>>;
	items: Record<string, z.infer<typeof ItemSchema>>;
	startingState: z.infer<typeof StartingStateSchema>;
};
