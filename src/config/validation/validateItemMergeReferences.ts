import { addIssue } from "~/config/validation/GameConfigValidationCommon";
import { validateActivationOutput } from "~/config/validation/validateGameConfigActivationOutput";
import type {
	ConfigDefinitionReferenceContext,
	ConfigItem,
} from "~/config/validation/ConfigDefinitionReferenceTypes";

export const validateItemMergeReferences = ({
	ctx,
	grantIds,
	hasItem,
	item,
	itemId,
	itemIds,
}: {
	ctx: ConfigDefinitionReferenceContext["ctx"];
	grantIds: ConfigDefinitionReferenceContext["grantIds"];
	hasItem: ConfigDefinitionReferenceContext["hasItem"];
	item: ConfigItem;
	itemId: string;
	itemIds: ConfigDefinitionReferenceContext["itemIds"];
}) => {
	for (const [mergeIndex, merge] of (item.merges ?? []).entries()) {
		if (!hasItem(merge.withItemId)) {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"merges",
					mergeIndex,
					"withItemId",
				],
				`Missing item "${merge.withItemId}".`,
			);
		}
		if ("resultItemId" in merge && !hasItem(merge.resultItemId)) {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"merges",
					mergeIndex,
					"resultItemId",
				],
				`Missing item "${merge.resultItemId}".`,
			);
		}
		if (merge.output) {
			validateActivationOutput(
				ctx,
				[
					"items",
					itemId,
					"merges",
					mergeIndex,
					"output",
				],
				merge.output,
				{
					grantIds,
					hasItem,
					itemIds,
				},
			);
		}
	}
};
