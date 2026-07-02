import type { GameConfig } from "~/config/GameConfigSchema";

export type GameEffect = NonNullable<GameConfig["items"][string]["effects"]>[number];

export type GameConfigEffectEntry = {
	effect: GameEffect;
	ownerItemId: string;
	ownerKind: "item" | "line";
	lineId?: string;
};

const readGameConfigEffects = (config: GameConfig): GameConfigEffectEntry[] =>
	Object.entries(config.items).flatMap(([ownerItemId, item]) => {
		const itemEffects = (item.effects ?? []).map((effect) => ({
			effect,
			ownerItemId,
			ownerKind: "item" as const,
		}));
		const producerEffects = (item.producer?.lines ?? []).flatMap((line) =>
			line.effect
				? [
						{
							effect: line.effect,
							lineId: line.id,
							ownerItemId,
							ownerKind: "line" as const,
						},
					]
				: [],
		);
		const stashEffect = item.stash?.line.effect
			? [
					{
						effect: item.stash.line.effect,
						lineId: item.stash.line.id,
						ownerItemId,
						ownerKind: "line" as const,
					},
				]
			: [];

		return [
			...itemEffects,
			...producerEffects,
			...stashEffect,
		];
	});

export const readGameConfigEffect = ({
	config,
	effectId,
}: {
	config: GameConfig;
	effectId: string;
}) => readGameConfigEffects(config).find((entry) => entry.effect.id === effectId)?.effect;
