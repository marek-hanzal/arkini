import type { PropsWithChildren } from "react";
import { Button, PrimaryButton } from "~/ui/ui/Button";
import { LauncherScene } from "~/launcher/ui/LauncherScene";

const actionPanelViewTransitionName = "arkini-action-panel";

interface ActionErrorPageProps extends PropsWithChildren {
	readonly error: unknown;
	readonly resetFn?: () => void;
	readonly resetLabel?: string;
	readonly description: string;
	readonly onBackFn?: () => void;
	readonly title: string;
}

/** Keeps one route-action failure visible with only its explicitly supplied actions. */
export const ActionErrorPage = ({
	description,
	error,
	onBackFn,
	resetFn,
	resetLabel = "Retry",
	title,
	children,
}: ActionErrorPageProps) => {
	const errorMessage = error instanceof Error ? error.message : String(error);
	return (
		<LauncherScene
			compactHero
			dataUi="ActionErrorPage"
			layout="fixed-hero"
		>
			<section
				className="grid max-w-lg gap-4 rounded-2xl border border-danger/35 bg-surface p-[var(--ak-panel-padding)] text-center shadow-2xl"
				data-ui="ActionErrorPanel"
				style={{
					viewTransitionName: actionPanelViewTransitionName,
				}}
			>
				<h1 className="text-lg font-semibold text-danger">{title}</h1>
				<p className="text-sm text-muted">{description}</p>
				<p className="text-xs text-danger">{errorMessage}</p>
				<div className="flex flex-wrap justify-center gap-2">
					{children}
					{resetFn === undefined ? null : (
						<PrimaryButton onClick={resetFn}>{resetLabel}</PrimaryButton>
					)}
					{onBackFn === undefined ? null : <Button onClick={onBackFn}>Back</Button>}
				</div>
			</section>
		</LauncherScene>
	);
};
