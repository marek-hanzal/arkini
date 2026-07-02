import defaultGameAssetsJson from "../../../game/arkini.assets.json";
import defaultGameConfigJson from "../../../game/arkini.game.json";
import { GameConfigSchema } from "~/config/GameConfigSchema";

export const defaultGameConfig = GameConfigSchema.parse({
	...defaultGameConfigJson,
	resources: defaultGameAssetsJson.resources,
});
