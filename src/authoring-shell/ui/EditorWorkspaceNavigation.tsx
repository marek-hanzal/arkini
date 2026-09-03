import { formatForDisplay } from "@tanstack/react-hotkeys";
import { LogOut, RefreshCw } from "lucide-react";
import { Fragment } from "react";

import {
	EditorWorkspaceRoutes,
	type EditorWorkspaceId,
} from "~/authoring-shell/ui/useEditorActiveWorkspace";
import { Button, ButtonLink } from "~/ui/ui/Button";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { Tooltip } from "~/ui/ui/Tooltip";

const tabClassName =
	"ak-editor-workspace-tab size-11 min-h-0 shrink-0 border-transparent bg-transparent p-0 shadow-none transition-none hover:bg-surface-raised";

interface EditorWorkspaceNavigationProps {
	readonly activeWorkspace: EditorWorkspaceId | undefined;
	readonly exitDisabled: boolean;
	readonly exitPending: boolean;
	readonly onExitFn: () => void;
	readonly onRefreshFn: () => void;
	readonly projectId: string;
	readonly refreshDisabled: boolean;
	readonly refreshPending: boolean;
	readonly refreshTooltip: string;
	readonly transitioningWorkspace: EditorWorkspaceId | undefined;
}

/** Renders the stable workspace navigation and its two process commands. */
export const EditorWorkspaceNavigation = ({
	activeWorkspace,
	exitDisabled,
	exitPending,
	onExitFn,
	onRefreshFn,
	projectId,
	refreshDisabled,
	refreshPending,
	refreshTooltip,
	transitioningWorkspace,
}: EditorWorkspaceNavigationProps) => (
	<aside
		className="relative z-20 flex min-h-0 w-16 flex-col items-center gap-2 border-r border-line bg-surface p-2 shadow-lg"
		data-ui="EditorNavigation"
		style={{
			viewTransitionName: "arkini-editor-navigation",
		}}
	>
		<nav className="ak-editor-workspace-tabs flex min-h-0 flex-col items-center gap-1">
			{EditorWorkspaceRoutes.map((workspace) => {
				const { icon: Icon, id, label, shortcut, to } = workspace;
				return (
					<Fragment key={id}>
						<Tooltip
							content={`${label} · ${formatForDisplay(shortcut)}`}
							placement="right"
						>
							<ButtonLink
								to={to}
								params={{
									projectId,
								}}
								className={tabClassName}
								data-workspace-id={id}
								{...readDataUiFn({
									dataUi: "EditorWorkspaceTab",
									state: {
										current: activeWorkspace === id,
										transitioning: transitioningWorkspace === id,
									},
								})}
							>
								<Icon className="size-5" />
							</ButtonLink>
						</Tooltip>
						{"separatorAfter" in workspace ? (
							<div className="my-1 h-px w-8 shrink-0 bg-line" />
						) : null}
					</Fragment>
				);
			})}
		</nav>
		<Tooltip
			content={refreshTooltip}
			placement="right"
		>
			<Button
				className="mt-auto size-11 min-h-0 shrink-0 border-transparent bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised"
				data-ui="EditorProjectRefresh"
				disabled={refreshDisabled}
				cursorIntent={refreshPending ? "progress" : undefined}
				onClick={onRefreshFn}
			>
				<RefreshCw className="size-5" />
			</Button>
		</Tooltip>
		<Tooltip
			content="Exit"
			placement="right"
		>
			<Button
				className="size-11 min-h-0 shrink-0 border-transparent bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised"
				data-ui="EditorExit"
				disabled={exitDisabled}
				cursorIntent={exitPending ? "progress" : undefined}
				onClick={onExitFn}
			>
				<LogOut className="size-5" />
			</Button>
		</Tooltip>
	</aside>
);
