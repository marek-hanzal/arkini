import { addIssue, validateUniqueStringList } from "~/config/validation/GameConfigValidationCommon";
import type {
	ConfigDefinitionReferenceContext,
	ConfigItem,
} from "~/config/validation/ConfigDefinitionReferenceTypes";

export const validateItemOwnDefinition = ({
	ctx,
	hasItem,
	item,
	itemId,
}: {
	ctx: ConfigDefinitionReferenceContext["ctx"];
	hasItem: ConfigDefinitionReferenceContext["hasItem"];
	item: ConfigItem;
	itemId: string;
}) => {
	validateUniqueStringList(
		ctx,
		[
			"items",
			itemId,
			"tags",
		],
		item.tags,
		(value) => `Duplicate tag "${value}".`,
	);

	if (item.capacity?.onDepleted === "replace" && !hasItem(item.capacity.replaceItemId)) {
		addIssue(
			ctx,
			[
				"items",
				itemId,
				"capacity",
				"replaceItemId",
			],
			`Missing item "${item.capacity.replaceItemId}".`,
		);
	}
	if (item.capacity && item.maxStackSize !== 1) {
		addIssue(
			ctx,
			[
				"items",
				itemId,
				"maxStackSize",
			],
			`Item "${itemId}" has capacity and must use maxStackSize 1 to preserve per-instance state.`,
		);
	}
};
