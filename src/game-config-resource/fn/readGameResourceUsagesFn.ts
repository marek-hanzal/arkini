import { Order } from "effect";

import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { DiagnosticPathSchema } from "~/game-config/diagnostic/schema/DiagnosticPathSchema";

export namespace readGameResourceUsagesFn {
	export type Usage =
		| {
				readonly resourceId: string;
				readonly owner: "project";
				readonly ownerLabel: "Project";
				readonly roleLabel: string;
				readonly path: DiagnosticPathSchema.Type;
		  }
		| {
				readonly resourceId: string;
				readonly owner: "item";
				readonly ownerId: string;
				readonly ownerUid: string;
				readonly ownerLabel: string;
				readonly roleLabel: string;
				readonly path: DiagnosticPathSchema.Type;
		  };
}

const projectRoles = [
	{
		id: "hero",
		label: "Hero",
	},
	{
		id: "avatar-01",
		label: "Avatar 1",
	},
	{
		id: "avatar-02",
		label: "Avatar 2",
	},
	{
		id: "avatar-03",
		label: "Avatar 3",
	},
	{
		id: "avatar-04",
		label: "Avatar 4",
	},
	{
		id: "avatar-05",
		label: "Avatar 5",
	},
	{
		id: "avatar-06",
		label: "Avatar 6",
	},
	{
		id: "avatar-07",
		label: "Avatar 7",
	},
] as const;

/** Projects every canonical config-to-resource reference in deterministic presentation order. */
export const readGameResourceUsagesFn = (
	config: GameConfigSchema.Type,
): readGameResourceUsagesFn.Usage[] => {
	const usages: readGameResourceUsagesFn.Usage[] = [];
	for (const role of projectRoles) {
		const resourceId = config.resources[role.id];
		if (resourceId === undefined) continue;
		usages.push({
			resourceId,
			owner: "project",
			ownerLabel: "Project",
			roleLabel: role.label,
			path: [
				"resources",
				role.id,
			],
		});
	}
	for (const [itemId, item] of Object.entries(config.items).sort(([left], [right]) =>
		Order.String(left, right),
	)) {
		item.asset.default.forEach((resourceId, index) => {
			usages.push({
				resourceId,
				owner: "item",
				ownerId: itemId,
				ownerUid: item.uid,
				ownerLabel: item.title,
				roleLabel: `Default artwork ${index + 1}`,
				path: [
					"items",
					itemId,
					"asset",
					"default",
					index,
				],
			});
		});
		item.asset.sources?.forEach((resourceId, index) => {
			usages.push({
				resourceId,
				owner: "item",
				ownerId: itemId,
				ownerUid: item.uid,
				ownerLabel: item.title,
				roleLabel: `Progress artwork ${index + 1}`,
				path: [
					"items",
					itemId,
					"asset",
					"sources",
					index,
				],
			});
		});
	}
	return usages;
};
