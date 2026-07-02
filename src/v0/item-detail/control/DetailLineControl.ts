import type {
	DetailActionControl,
	DetailProgressActionControl,
} from "~/v0/item-detail/control/DetailActionControl";

export interface DetailLineControl {
	defaultAction?: DetailActionControl;
	primaryAction: DetailProgressActionControl;
	withdrawInputActionsByItemId: Readonly<Record<string, DetailActionControl | undefined>>;
}
