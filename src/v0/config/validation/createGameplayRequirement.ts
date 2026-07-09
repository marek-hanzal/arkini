import type { z } from "zod";
import type { ResolvedDomainSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import type { GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";
import type { GameplayRequirement } from "~/config/validation/GameplaySoftLockTypes";

export const createGrantRequirement = ({
	path,
	selector,
}: {
	path: GameConfigIssuePath;
	selector: z.infer<typeof ResolvedDomainSelectorSchema>;
}): GameplayRequirement => ({
	kind: "grantSelector",
	path,
	selector,
});

export const createNearbyItemRequirement = ({
	path,
	selector,
}: {
	path: GameConfigIssuePath;
	selector: z.infer<typeof ResolvedDomainSelectorSchema>;
}): GameplayRequirement => ({
	kind: "nearbyItemSelector",
	path,
	selector,
});

export const createItemRequirement = ({
	itemId,
	path,
}: {
	itemId: string;
	path: GameConfigIssuePath;
}): GameplayRequirement => ({
	itemId,
	kind: "item",
	path,
});
