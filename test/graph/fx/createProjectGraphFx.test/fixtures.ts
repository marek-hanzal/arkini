import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { Project } from "~/project-authoring/type/Project";

export const projectFn = (
	links: readonly (readonly [
		string,
		string,
	])[],
	extra: readonly string[] = [],
): Project => {
	const ids = [
		...new Set([
			...links.flat(),
			...extra,
		]),
	];
	const config = GameConfigSchema.parse({
		meta: {
			id: "graph",
			title: "Graph",
			board: {
				width: 4,
				height: 4,
			},
		},
		resources: {
			hero: "hero",
		},
		start: {
			currentSpace: 0,
			spaces: [],
		},
		items: Object.fromEntries(
			ids.map((uid) => {
				const merges = links
					.filter(([from]) => from === uid)
					.map(([, to]) => ({
						target: {
							type: "item",
							itemUid: to,
						},
						action: "use",
						effect: "keep",
					}));
				return [
					uid,
					{
						uid,
						title: uid,
						artwork: {
							default: [
								"art",
							],
							scale: 1,
						},
						...(merges.length
							? {
									merge: merges,
								}
							: {}),
					},
				];
			}),
		),
	});
	return {
		projectId: "graph",
		revision: 1,
		title: "Graph",
		version: {
			major: 1,
			minor: 0,
		},
		createdAtMs: 0,
		updatedAtMs: 0,
		resources: [],
		config,
	};
};
