import type { BoardCell } from "~/v0/game/board/BoardCell";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { compareGameEffectSourceInstances } from "~/v0/game/effects/compareGameEffectSourceInstances";
import { doesGameEffectGrantTargetCraftRecipe } from "~/v0/game/effects/doesGameEffectGrantTargetCraftRecipe";
import { doesGameEffectGrantTargetItem } from "~/v0/game/effects/doesGameEffectGrantTargetItem";
import { doesGameEffectGrantTargetProductLine } from "~/v0/game/effects/doesGameEffectGrantTargetProductLine";
import { doesGameEffectSourceApplyToBoardCell } from "~/v0/game/effects/doesGameEffectSourceApplyToBoardCell";
import { readGameEffectSourceInstances } from "~/v0/game/effects/readGameEffectSourceInstances";

export namespace readGameEffectTargetGrantIds {
	export type Target =
		| {
				kind: "craftRecipe";
				craftRecipeId: string;
				targetCell?: BoardCell;
		  }
		| {
				kind: "item";
				itemId: string;
				targetCell?: BoardCell;
		  }
		| {
				kind: "productLine";
				producerId: string;
				productId: string;
				targetCell?: BoardCell;
		  };

	export interface Props {
		config: GameConfig;
		ignoredProducerJobIds?: ReadonlySet<string>;
		ignoredSourceIds?: ReadonlySet<string>;
		nowMs?: number;
		save: GameSave;
		target: Target;
	}
}

const doesGrantOperationTarget = ({
	operation,
	target,
}: {
	operation: Extract<
		GameConfig["effects"][string]["operations"][number],
		{
			kind: "grant.add";
		}
	>;
	target: readGameEffectTargetGrantIds.Target;
}) => {
	if (target.kind === "craftRecipe") {
		return doesGameEffectGrantTargetCraftRecipe({
			craftRecipeId: target.craftRecipeId,
			target: operation.target,
		});
	}

	if (target.kind === "item") {
		return doesGameEffectGrantTargetItem({
			itemId: target.itemId,
			target: operation.target,
		});
	}

	return doesGameEffectGrantTargetProductLine({
		producerId: target.producerId,
		productId: target.productId,
		target: operation.target,
	});
};

export const readGameEffectTargetGrantIds = ({
	config,
	ignoredProducerJobIds,
	ignoredSourceIds,
	nowMs,
	save,
	target,
}: readGameEffectTargetGrantIds.Props) => {
	const grants = new Set<string>();
	const sources = readGameEffectSourceInstances({
		config,
		ignoredProducerJobIds,
		nowMs,
		save,
	})
		.filter((source) => !ignoredSourceIds?.has(source.sourceId))
		.filter((source) =>
			doesGameEffectSourceApplyToBoardCell({
				config,
				save,
				source,
				targetCell: target.targetCell,
			}),
		)
		.sort((left, right) =>
			compareGameEffectSourceInstances({
				config,
				left,
				right,
				save,
				targetCell: target.targetCell,
			}),
		);

	for (const source of sources) {
		const effect = config.effects[source.effectId];
		if (!effect) continue;

		for (const operation of effect.operations) {
			if (operation.kind !== "grant.add") continue;
			if (
				!doesGrantOperationTarget({
					operation,
					target,
				})
			)
				continue;
			grants.add(operation.grantId);
		}
	}

	return grants;
};
