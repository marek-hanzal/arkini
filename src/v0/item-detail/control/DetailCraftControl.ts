import type { DetailActionControl } from "~/v0/item-detail/control/DetailActionControl";

export interface DetailCraftControl {
	primaryAction: DetailActionControl;
	withdrawInputActionsByItemId: Readonly<Record<string, DetailActionControl | undefined>>;
}
