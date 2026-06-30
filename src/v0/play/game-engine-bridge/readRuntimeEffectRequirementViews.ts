import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export namespace readRuntimeEffectRequirementViews {
	export interface Props {
		config: GameConfig;
		grantIds: readonly string[];
		selector: NonNullable<GameConfig["products"][string]["grantSelector"]>;
	}
}

type EffectRequirementView = NonNullable<ProducerProductLineView["effectRequirements"]>[number];

const readGrantLabel = ({ config, grantId }: { config: GameConfig; grantId: string }) => {
	for (const [effectId, effect] of Object.entries(config.effects)) {
		if (
			!effect.operations.some(
				(operation) => operation.kind === "grant.add" && operation.grantId === grantId,
			)
		) {
			continue;
		}

		const sourceItem = Object.values(config.items).find((item) =>
			item.passiveEffectIds?.includes(effectId),
		);
		if (sourceItem) {
			return effect.scope === "local"
				? `Nearby ${sourceItem.name}`
				: `Have ${sourceItem.name}`;
		}

		return effect.name.replace(/ enables production$/, "");
	}

	return grantId.replace(/^grant:/, "").replaceAll(":", " ");
};

const readClauseLabel = ({ config, ids }: { config: GameConfig; ids: readonly string[] }) => {
	const labels = ids.map((grantId) =>
		readGrantLabel({
			config,
			grantId,
		}),
	);

	return labels.length === 1 ? labels[0] : `One of ${labels.join(" / ")}`;
};

export const readRuntimeEffectRequirementViews = ({
	config,
	grantIds,
	selector,
}: readRuntimeEffectRequirementViews.Props): EffectRequirementView[] => {
	if ("mode" in selector) return [];

	const grantIdSet = new Set(grantIds);
	const requirements: EffectRequirementView[] = [];

	for (const clause of selector.allOf ?? []) {
		requirements.push({
			label: readClauseLabel({
				config,
				ids: clause.ids,
			}),
			ready: clause.ids.some((grantId) => grantIdSet.has(grantId)),
		});
	}

	if (selector.anyOf?.length) {
		const ready = selector.anyOf.some((clause) =>
			clause.ids.some((grantId) => grantIdSet.has(grantId)),
		);
		requirements.push({
			label: readClauseLabel({
				config,
				ids: selector.anyOf.flatMap((clause) => clause.ids),
			}),
			ready,
		});
	}

	for (const clause of selector.noneOf ?? []) {
		requirements.push({
			label: `Without ${readClauseLabel({
				config,
				ids: clause.ids,
			})}`,
			ready: !clause.ids.some((grantId) => grantIdSet.has(grantId)),
		});
	}

	return requirements;
};
