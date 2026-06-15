import type { ItemDefinition } from "../item";
import type { ItemId } from "../manifestId";
import { assertActivationDefinition } from "./assertActivationDefinition";

export const assertProducerDefinition = (item: ItemDefinition, itemIds: Set<ItemId>) => {
	assertActivationDefinition(item.id, item.producer, itemIds, "producer");
	assertActivationDefinition(item.id, item.stash, itemIds, "stash");
};
