import { doesGameGrantSelectorMatchIds } from "~/effects/doesGameGrantSelectorMatchIds";
import type { DropEffect } from "~/effects/RuntimeLineEffectTypes";

export const readDropEffectGrantActive = ({
	effect,
	grantIds,
}: {
	effect: Extract<
		DropEffect,
		{
			selector: unknown;
		}
	>;
	grantIds: ReadonlySet<string>;
}) =>
	doesGameGrantSelectorMatchIds({
		grantIds,
		selector: effect.selector,
	});
