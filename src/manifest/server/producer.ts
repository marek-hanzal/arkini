import type { ItemId } from "./ids";

export interface ProducerDefinition {
  trigger: "click";
  placement: "board_then_inventory";
  drops: readonly ProducerDrop[];
  cooldownMs?: number;
  mode?: ProducerMode;
  doubleClickBehavior?: "exhaust";
}

export type ProducerMode =
  | { type: "infinite" }
  | { type: "finite"; charges: number; onDepleted: "remove" | { replaceWithItemId: ItemId } };

export type ProducerDrop =
  | { itemId: ItemId; weight: number; quantity?: Quantity }
  | { itemId: null; weight: number; quantity?: never };

export type Quantity = number | { min: number; max: number };
