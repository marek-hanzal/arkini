import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { readDraftRollOutcomesFn } from "~/production-authoring/fn/readDraftRollOutcomesFn";

/** Indexes authored references only; it never expands the related items' own capabilities. */
export const readCapabilityRelatedTermsFn = (
	capability: LineSchema.Type | MergeSchema.Type,
	items: GameConfigSchema.Type["items"],
): readonly string[] => {
	const ids = new Set<string>();
	if ("input" in capability) {
		for (const input of capability.input) {
			switch (input.type) {
				case "materials":
					ids.add(input.query.selector.itemId);
					break;
				case "units":
					ids.add(input.query.selector.itemId);
					break;
				case "simple":
					break;
			}
		}
		for (const rule of capability.rules)
			for (const when of rule.when) ids.add(when.query.selector.itemId);
	} else {
		if (capability.action !== "space") ids.add(capability.target.itemId);
		if (capability.effect === "replace") ids.add(capability.result);
	}
	for (const set of capability.outcome?.set ?? []) {
		for (const rule of set.rules)
			for (const when of rule.when) ids.add(when.query.selector.itemId);
		for (const roll of set.roll) {
			const drops = readDraftRollOutcomesFn(roll);
			for (const drop of drops) {
				if (drop.type === "item") ids.add(drop.itemId);
				for (const rule of drop.rules)
					for (const when of rule.when) ids.add(when.query.selector.itemId);
			}
		}
	}
	return [
		...new Set(
			[
				...ids,
			].flatMap((id) => [
				id,
				items[id]?.title ?? id,
			]),
		),
	];
};
