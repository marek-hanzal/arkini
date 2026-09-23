import { Order } from "effect";

import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { DiagnosticPathSchema } from "~/game-config-diagnostic/schema/DiagnosticPathSchema";
import { SfxEventEnumSchema } from "~/sfx-event/schema/SfxEventEnumSchema";

export namespace readGameResourceUsagesFn {
	export type Usage =
		| {
				readonly resourceUid: string;
				readonly resourceType: "image" | "music" | "sfx";
				readonly owner: "project";
				readonly ownerLabel: "Project";
				readonly roleLabel: string;
				readonly path: DiagnosticPathSchema.Type;
		  }
		| {
				readonly resourceUid: string;
				readonly resourceType: "artwork" | "music";
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
	{
		id: "avatar-08",
		label: "Avatar 8",
	},
] as const;

/** Projects every canonical config-to-resource reference in deterministic presentation order. */
export const readGameResourceUsagesFn = (
	config: GameConfigSchema.Type,
): readGameResourceUsagesFn.Usage[] => {
	const usages: readGameResourceUsagesFn.Usage[] = [];
	for (const role of projectRoles) {
		const resourceUid = config.resources[role.id];
		if (resourceUid === undefined) continue;
		usages.push({
			resourceUid,
			resourceType: "image",
			owner: "project",
			ownerLabel: "Project",
			roleLabel: role.label,
			path: [
				"resources",
				role.id,
			],
		});
	}
	config.music?.playlist.forEach((resourceUid, index) => {
		usages.push({
			resourceUid,
			resourceType: "music",
			owner: "project",
			ownerLabel: "Project",
			roleLabel: `Random playlist track ${index + 1}`,
			path: [
				"music",
				"playlist",
				index,
			],
		});
	});
	for (const event of SfxEventEnumSchema.options) {
		const resourceUid = config.sfx?.events[event];
		if (resourceUid === undefined) continue;
		usages.push({
			resourceUid,
			resourceType: "sfx",
			owner: "project",
			ownerLabel: "Project",
			roleLabel: event,
			path: [
				"sfx",
				"events",
				event,
			],
		});
	}
	for (const [itemUid, item] of Object.entries(config.items).sort(([left], [right]) =>
		Order.String(left, right),
	)) {
		if (item.music !== undefined) {
			usages.push({
				resourceUid: item.music,
				resourceType: "music",
				owner: "item",
				ownerId: itemUid,
				ownerUid: item.uid,
				ownerLabel: item.title,
				roleLabel: "Item detail music",
				path: [
					"items",
					itemUid,
					"music",
				],
			});
		}
		item.artwork.default.forEach((resourceUid, index) => {
			usages.push({
				resourceUid,
				resourceType: "artwork",
				owner: "item",
				ownerId: itemUid,
				ownerUid: item.uid,
				ownerLabel: item.title,
				roleLabel: `Default artwork ${index + 1}`,
				path: [
					"items",
					itemUid,
					"artwork",
					"default",
					index,
				],
			});
		});
		item.lines.forEach((line, index) => {
			if (line.artwork === undefined) return;
			usages.push({
				resourceUid: line.artwork,
				resourceType: "artwork",
				owner: "item",
				ownerId: itemUid,
				ownerUid: item.uid,
				ownerLabel: item.title,
				roleLabel: `Production line artwork: ${line.title}`,
				path: [
					"items",
					itemUid,
					"lines",
					index,
					"artwork",
				],
			});
		});
	}
	return usages;
};
