import type { ItemId, MergeDefinitionId } from "./ids";

export interface ItemMergeRule {
  id: MergeDefinitionId;
  withItemId: ItemId;
  resultItemId: ItemId;
  inputCount?: 2;
  secret?: boolean;
}

export function pairKey(first: ItemId | string, second: ItemId | string) {
  return [first, second].sort().join("+");
}
