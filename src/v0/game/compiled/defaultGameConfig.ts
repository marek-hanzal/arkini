import defaultGameConfigJson from "../../../../game/arkini.game.json";
import { GameConfigSchema } from "~/v0/game/config/GameConfigSchema";

type CompiledAssetIndex = Record<
	string,
	{
		resourceId: string;
	}
>;

const resources = Object.fromEntries(
	Object.values(defaultGameConfigJson.assets as CompiledAssetIndex).map((asset) => [
		asset.resourceId,
		{
			data: "engine-runtime-resource-placeholder",
		},
	]),
);

export const defaultGameConfig = GameConfigSchema.parse({
	...defaultGameConfigJson,
	resources,
});
