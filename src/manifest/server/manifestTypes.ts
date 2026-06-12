import type { AssetDefinition } from "./asset";
import type { ItemId } from "./ids";
import type { ItemDefinition } from "./item";

export interface GameDataManifest {
  game: {
    id: "arkini";
    title: "Arkini";
    board: { width: 7; height: 9 };
    inventory: { slots: number };
  };
  assets: readonly AssetDefinition[];
  items: readonly ItemDefinition[];
  startingState: {
    inventory: readonly { itemId: ItemId; quantity: number }[];
    board: readonly { itemId: ItemId; x: number; y: number }[];
  };
}
