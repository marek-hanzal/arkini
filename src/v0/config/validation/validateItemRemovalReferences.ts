import { addIssue } from "~/config/validation/GameConfigValidationCommon";
import { validateActivationOutput } from "~/config/validation/validateGameConfigActivationOutput";
import type {
	ConfigDefinitionReferenceContext,
	ConfigItem,
} from "~/config/validation/ConfigDefinitionReferenceTypes";

export const validateItemRemovalReferences = ({
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
	for (const [index, removal] of (item.removeBy ?? []).entries()) {
		if (!hasItem(removal.itemId)) {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"removeBy",
					index,
					"itemId",
				],
				`Missing item "${removal.itemId}".`,
			);
		}
		if (removal.output) {
			validateActivationOutput(
				ctx,
				[
					"items",
					itemId,
					"removeBy",
					index,
					"output",
				],
				removal.output,
				{
					grantIds,
					hasItem,
					itemIds,
				},
			);
		}
	}
};
