import type {
	DetailActionControl,
	DetailProgressActionControl,
} from "~/v0/item-detail/control/DetailActionControl";

export interface DetailCraftControl {
	primaryAction: DetailProgressActionControl;
	statusLabel: string;
	withdrawInputActionsByItemId: Readonly<Record<string, DetailActionControl | undefined>>;
}
