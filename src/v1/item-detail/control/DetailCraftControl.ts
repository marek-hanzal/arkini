import type { DetailActionControl } from "~/v1/item-detail/control/DetailActionControl";

export interface DetailCraftControl {
	primaryAction: DetailActionControl;
	withdrawInputActionsByItemId: Readonly<Record<string, DetailActionControl | undefined>>;
}
