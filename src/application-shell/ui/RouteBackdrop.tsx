const launcherBackdropViewTransitionName = "arkini-launcher-backdrop";

interface RouteBackdropProps {
	readonly className: string;
	readonly dataUi: string;
}

/** Gives every fullscreen route background one native View Transition identity. */
export const RouteBackdrop = ({ className, dataUi }: RouteBackdropProps) => (
	<div
		className={className}
		data-ui={dataUi}
		style={{
			viewTransitionName: launcherBackdropViewTransitionName,
		}}
	/>
);
