import { addIssue } from "~/config/validation/GameConfigValidationCommon";
import {
	validateCraftCapability,
	validateProducerCapability,
} from "~/config/validation/validateGameConfigCapabilities";
import type {
	ConfigDefinitionReferenceContext,
	ConfigItem,
} from "~/config/validation/ConfigDefinitionReferenceTypes";

export const validateItemCapabilityReferences = ({
	ctx,
	grantIds,
	hasItem,
	item,
	itemId,
	itemIds,
	value,
}: {
	ctx: ConfigDefinitionReferenceContext["ctx"];
	grantIds: ConfigDefinitionReferenceContext["grantIds"];
	hasItem: ConfigDefinitionReferenceContext["hasItem"];
	item: ConfigItem;
	itemId: string;
	itemIds: ConfigDefinitionReferenceContext["itemIds"];
	value: ConfigDefinitionReferenceContext["value"];
}) => {
	if (item.producer && item.stash) {
		addIssue(
			ctx,
			[
				"items",
				itemId,
			],
			`Item "${itemId}" must not define both producer and stash capabilities.`,
		);
	}

	if (item.producer) {
		validateProducerCapability({
			capability: item.producer,
			capabilityId: itemId,
			ctx,
			grantIds,
			hasItem,
			itemIds,
			section: "producer",
		});
	}
	if (item.stash) {
		validateProducerCapability({
			capability: item.stash,
			capabilityId: itemId,
			ctx,
			grantIds,
			hasItem,
			itemIds,
			section: "stash",
		});
	}
	if (item.craft) {
		validateCraftCapability({
			craftItemId: itemId,
			ctx,
			grantIds,
			hasItem,
			itemIds,
			recipe: item.craft,
			value,
		});
	}
};
