import { launcherBackdropViewTransitionName } from "~/ui/navigation/launcherBackdropViewTransitionName";

export namespace RouteBackdrop {
	export interface Props {
		readonly className: string;
		readonly dataUi: string;
	}
}

/** Gives every fullscreen route background one native View Transition identity. */
export const RouteBackdrop = ({ className, dataUi }: RouteBackdrop.Props) => (
	<div
		className={className}
		aria-hidden="true"
		data-ui={dataUi}
		style={{
			viewTransitionName: launcherBackdropViewTransitionName,
		}}
	/>
);
