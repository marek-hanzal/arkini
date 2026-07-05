import type { z } from "zod";
import type { ActivationOutputSchema } from "~/config/schema/GameActivationOutputSchema";
import type { ResolvedDomainSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import type { GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";
import {
	readActivationOutputEffectEntries,
	type Line,
} from "~/config/validation/GameConfigValidationReaders";
import {
	createGrantRequirement,
	createNearbyItemRequirement,
} from "~/config/validation/createGameplayRequirement";
import type { GameplayRequirement } from "~/config/validation/GameplaySoftLockTypes";

type GameplayOutputSourceEntry = ReturnType<typeof readActivationOutputEffectEntries>[number] & {
	availabilityRequirements: GameplayRequirement[];
};

export const readGameplayOutputSourceEntries = ({
	line,
	output,
	path,
}: {
	line: Line;
	output: z.infer<typeof ActivationOutputSchema>;
	path: GameConfigIssuePath;
}): GameplayOutputSourceEntry[] =>
	readActivationOutputEffectEntries({
		output,
		path,
	}).flatMap((entry) =>
		readOutputAvailabilityRequirementVariants({
			entry,
			line,
		}).map((availabilityRequirements, variantIndex) => ({
			...entry,
			availabilityRequirements,
			sourceKey:
				variantIndex === 0
					? entry.sourceKey
					: `${entry.sourceKey}:availability:${variantIndex}`,
		})),
	);

const readOutputAvailabilityRequirementVariants = ({
	entry,
	line,
}: {
	entry: ReturnType<typeof readActivationOutputEffectEntries>[number];
	line: Line;
}): GameplayRequirement[][] => {
	const visibilityRequirementVariants = readOutputVisibilityRequirementVariants({
		entry,
		line,
	});
	const enableRequirementVariants = readOutputEnableRequirementVariants(entry);

	return visibilityRequirementVariants.flatMap((visibilityRequirements) =>
		enableRequirementVariants.map((enableRequirements) => [
			...visibilityRequirements,
			...enableRequirements,
		]),
	);
};

const readOutputVisibilityRequirementVariants = ({
	entry,
	line,
}: {
	entry: ReturnType<typeof readActivationOutputEffectEntries>[number];
	line: Line;
}): GameplayRequirement[][] => {
	if (line.visibility !== "hidden" && entry.visibility !== "hidden")
		return [
			[],
		];

	return entry.effects.flatMap((effect, effectIndex) => {
		const effectPath = [
			...entry.path,
			"effects",
			effectIndex,
		] satisfies GameConfigIssuePath;

		if (effect.kind === "grant.drop.show") {
			return [
				[
					createGrantRequirement({
						path: [
							...effectPath,
							"selector",
						],
						selector: effect.selector,
					}),
				],
			];
		}

		if (effect.kind === "grant.require" && effect.phase === "visibility") {
			return [
				[
					createGrantRequirement({
						path: [
							...effectPath,
							"selector",
						],
						selector: effect.selector,
					}),
				],
			];
		}

		if (effect.kind === "nearby.require" && effect.phase === "visibility") {
			return [
				[
					createNearbyItemRequirement({
						path: [
							...effectPath,
							"items",
						],
						selector: effect.items as z.infer<typeof ResolvedDomainSelectorSchema>,
					}),
				],
			];
		}

		return [];
	});
};

const readOutputEnableRequirementVariants = (
	entry: ReturnType<typeof readActivationOutputEffectEntries>[number],
): GameplayRequirement[][] => {
	if (entry.enabled !== false)
		return [
			[],
		];

	return entry.effects.flatMap((effect, effectIndex) => {
		if (effect.kind !== "grant.drop.enable") return [];

		return [
			[
				createGrantRequirement({
					path: [
						...entry.path,
						"effects",
						effectIndex,
						"selector",
					],
					selector: effect.selector,
				}),
			],
		];
	});
};
