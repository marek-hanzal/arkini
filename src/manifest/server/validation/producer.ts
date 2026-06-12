import { match } from "ts-pattern";
import type { ItemId } from "../ids";
import type { ItemDefinition } from "../item";
import { assert } from "./assert";
import { assertQuantity } from "./quantity";

export function assertProducerDefinition(item: ItemDefinition, itemIds: Set<ItemId>) {
  const producer = item.producer;
  if (!producer) return;

  assert(Boolean(producer.cooldownMs), `${item.id} click producer must define cooldownMs`);
  assert(producer.drops.length > 0, `${item.id} producer must have drops`);
  for (const entry of producer.drops) {
    assert(entry.weight > 0, `${item.id} producer drop weight must be positive`);
    if (entry.itemId) assert(itemIds.has(entry.itemId), `${item.id} drops missing item ${entry.itemId}`);
    if (entry.quantity !== undefined) assertQuantity(entry.quantity, `${item.id} drop quantity`);
  }

  match(producer.mode ?? { type: "infinite" as const })
    .with({ type: "infinite" }, () => undefined)
    .with({ type: "finite" }, (mode) => {
      assert(mode.charges > 0, `${item.id} finite charges must be positive`);
      if (typeof mode.onDepleted !== "string") {
        assert(itemIds.has(mode.onDepleted.replaceWithItemId), `${item.id} replacement item is missing`);
      }
    })
    .exhaustive();
}
