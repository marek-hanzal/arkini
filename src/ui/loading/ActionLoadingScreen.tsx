import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { useController } from "~/ui/loading/useController";
import { actionProgressViewTransitionName } from "~/ui/navigation/actionProgressViewTransitionName";

const pendingProgressTransitionMs = 220;

export namespace ActionLoadingScreen {
	export interface Props extends useController.Props {
		readonly label: string;
	}
}

/** Presents one route-owned progress curve and keeps its terminal frame full until navigation or shutdown. */
export const ActionLoadingScreen = ({ completed, label }: ActionLoadingScreen.Props) => {
	const controller = useController({
		completed,
	});
	return (
		<LauncherScene
			className="cursor-wait"
			compactHero
			dataUi="ActionLoadingScreen"
			layout="fixed-hero"
		>
			<div
				className="flex w-[min(80cqw,28rem)] max-w-full flex-col items-center gap-3"
				data-ui="ActionLoadingScreenContent"
				style={{
					viewTransitionName: actionProgressViewTransitionName,
				}}
			>
				<div
					className="h-[clamp(0.375rem,1.25cqh,0.5rem)] w-full overflow-hidden rounded-full border border-line bg-surface-raised/60 shadow-inner"
					data-ui="ActionLoadingScreenProgress"
				>
					<div
						className="size-full origin-left rounded-full bg-accent transition-transform ease-out"
						data-ui="ActionLoadingScreenProgressFill"
						style={{
							transform: `scaleX(${controller.progress / 100})`,
							transitionDuration: `${pendingProgressTransitionMs}ms`,
						}}
					/>
				</div>
				<p
					className="text-center text-sm font-medium text-muted"
					data-ui="ActionLoadingScreenLabel"
				>
					{label}
				</p>
			</div>
		</LauncherScene>
	);
};
