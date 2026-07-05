import type { z } from "zod";
import type { GameDropEffectSchema } from "~/config/schema/GameDropEffectSchema";
import type { GameLineEffectSchema } from "~/config/schema/GameLineEffectSchema";
import type { ResolvedDomainSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import type { GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";

export type GameConfigRuntimeEffect =
	| z.infer<typeof GameLineEffectSchema>
	| z.infer<typeof GameDropEffectSchema>;

export type GameplayReachableEntityKind = "grant" | "item";

export type GameplayRequirement =
	| {
			itemId: string;
			kind: "item";
			path: GameConfigIssuePath;
	  }
	| {
			kind: "grantSelector";
			path: GameConfigIssuePath;
			selector: z.infer<typeof ResolvedDomainSelectorSchema>;
	  }
	| {
			kind: "nearbyItemSelector";
			path: GameConfigIssuePath;
			selector: z.infer<typeof ResolvedDomainSelectorSchema>;
	  };

export type GameplaySource = {
	label: string;
	path: GameConfigIssuePath;
	requirements: GameplayRequirement[];
	sourceId: string;
	targetId: string;
	targetKind: GameplayReachableEntityKind;
};

export type GameplayReachability = {
	reachableGrantIds: Set<string>;
	reachableItemIds: Set<string>;
};
