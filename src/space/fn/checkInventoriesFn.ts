import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { InventoryIssueSchema } from "~/space/schema/InventoryIssueSchema";
import { readAuthoredSpaceIdsFn } from "~/space/fn/readAuthoredSpaceIdsFn";

/** Saved bindings are exclusive, initialized, and separate from all authored numeric addresses. */
export const checkInventoriesFn = ({
	runtime,
	config,
}: {
	readonly runtime: RuntimeSchema.Type;
	readonly config: GameConfigSchema.Type;
}): readonly InventoryIssueSchema.Type[] => {
	const reserved = readAuthoredSpaceIdsFn(config);
	const owners = new Set<number>();
	const issues: InventoryIssueSchema.Type[] = [];
	for (const item of runtime.items) {
		const space = item.inventory;
		if (space === undefined) continue;
		const templateUid = runtime.templateUidBySpace[space];
		const reason = owners.has(space)
			? "duplicate-owner"
			: reserved.has(space)
				? "authored-address"
				: templateUid === undefined ||
						!config.templates?.some((template) => template.uid === templateUid)
					? "missing-template"
					: undefined;
		owners.add(space);
		if (reason !== undefined)
			issues.push({
				type: "space:inventory",
				itemId: item.id,
				space,
				reason,
			});
	}
	return issues;
};
