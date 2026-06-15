import type { InventoryView } from "~/inventory/view/InventoryViewSchema";

export namespace cloneInventoryStack {
	export type Stack = InventoryView["slots"][number]["stack"];
}

export const cloneInventoryStack = (stack: cloneInventoryStack.Stack) => {
	if (!stack) return undefined;

	return {
		...stack,
	};
};
