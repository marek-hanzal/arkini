import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import { StorageSchema } from "~/item-definition/schema/StorageSchema";

export namespace readPlacementRouteFn {
	export type Scope = GridLocationSchema.Type["scope"];

	export interface Step {
		readonly scope: Scope;
		readonly unavailableReason: PlacementUnavailableError.Reason;
	}

	export interface Props {
		readonly itemScope: StorageSchema.Type;
		readonly originScope: Scope;
		readonly toolbarEnabled: boolean;
	}
}

const stepByScope = {
	board: {
		scope: "board",
		unavailableReason: PlacementUnavailableError.Reason.BoardFull,
	},
	inventory: {
		scope: "inventory",
		unavailableReason: PlacementUnavailableError.Reason.InventoryFull,
	},
	toolbar: {
		scope: "toolbar",
		unavailableReason: PlacementUnavailableError.Reason.ToolbarFull,
	},
} as const satisfies Record<readPlacementRouteFn.Scope, readPlacementRouteFn.Step>;

const anyRouteByOrigin = {
	board: [
		stepByScope.board,
		stepByScope.inventory,
		stepByScope.toolbar,
	],
	inventory: [
		stepByScope.inventory,
		stepByScope.toolbar,
		stepByScope.board,
	],
	toolbar: [
		stepByScope.toolbar,
		stepByScope.inventory,
		stepByScope.board,
	],
} as const satisfies Record<
	readPlacementRouteFn.Scope,
	readonly [
		readPlacementRouteFn.Step,
		...readPlacementRouteFn.Step[],
	]
>;

/** Resolves authored storage permission into the ordered concrete placement attempts. */
export const readPlacementRouteFn = ({
	itemScope,
	originScope,
	toolbarEnabled,
}: readPlacementRouteFn.Props): readonly [
	readPlacementRouteFn.Step,
	...readPlacementRouteFn.Step[],
] => {
	if (itemScope !== StorageSchema.enum.Any)
		return [
			stepByScope[itemScope],
		];

	const route = anyRouteByOrigin[originScope];
	if (toolbarEnabled || originScope === "toolbar") return route;
	return route.filter((step) => step.scope !== "toolbar") as [
		readPlacementRouteFn.Step,
		...readPlacementRouteFn.Step[],
	];
};
