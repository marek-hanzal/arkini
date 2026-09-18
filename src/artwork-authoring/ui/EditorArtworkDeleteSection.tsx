import { Overlay } from "~/ui/ui/Overlay";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Tx } from "~/translation/ui/Tx";
import { Mx } from "~/translation/ui/Mx";
import { ShieldAlert, ShieldCheck } from "lucide-react";

import type { Project } from "~/project-authoring/type/Project";
import type { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import { Button, DangerButton } from "~/ui/ui/Button";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorArtworkDeleteController } from "~/artwork-authoring/ui/useEditorArtworkDeleteController";
import { EditorArtworkUsageRow } from "~/artwork-authoring/ui/EditorArtworkUsageRow";
import { Status } from "~/ui/ui/Status";

const EditorArtworkDeleteError = ({ error }: { readonly error: unknown }) =>
	error === undefined ? null : (
		<p className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
			{error instanceof Error ? error.message : String(error)}
		</p>
	);

const EditorArtworkDeleteDialog = ({
	error,
	pending,
	resourceId,
	onCancelFn,
	onConfirmFn,
}: {
	readonly error: unknown;
	readonly pending: boolean;
	readonly resourceId: string;
	readonly onCancelFn: () => void;
	readonly onConfirmFn: () => void;
}) => (
	<Overlay
		onCloseFn={() => {
			if (!pending) onCancelFn();
		}}
	>
		<div
			className="w-full max-w-md rounded-2xl border border-line-strong bg-modal p-6 text-foreground shadow-2xl"
			data-ui="EditorArtworkDeleteDialog"
		>
			<h2 className="text-lg font-semibold">
				<Tx label="Delete artwork?" />
			</h2>
			<p className="mt-2 text-sm leading-6 text-muted">
				<Tx label="Delete artwork" />:{" "}
				<strong className="text-foreground">{resourceId}</strong>
			</p>
			<div className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm leading-6 text-danger">
				<Mx label="Artwork delete confirmation warning" />
			</div>
			<p className="mt-2 text-xs text-subtle">
				<Tx label="Artwork ID" />: {resourceId}
			</p>
			<EditorArtworkDeleteError error={error} />
			<div className="mt-6 flex flex-wrap justify-end gap-2">
				<Button
					disabled={pending}
					onClick={onCancelFn}
				>
					<Tx label="Cancel" />
				</Button>
				<DangerButton
					disabled={pending}
					cursorIntent={pending ? "progress" : undefined}
					data-ui="EditorArtworkDeleteConfirm"
					onClick={onConfirmFn}
				>
					<Tx label="Delete artwork" />
				</DangerButton>
			</div>
		</div>
	</Overlay>
);

const EditorArtworkDeleteBlockerLink = ({
	blocker,
	project,
}: {
	readonly blocker: readGameResourceUsagesFn.Usage;
	readonly project: Project;
}) => {
	const translator = useTranslator();
	if (blocker.owner === "item") {
		const owner = project.config.items[blocker.ownerId];
		if (owner !== undefined)
			return (
				<EditorArtworkUsageRow
					dataUi="EditorArtworkDeleteBlocker"
					leading={
						<EditorItemThumbnail
							resourceIds={owner.artwork.default}
							size="sm"
						/>
					}
					project={project}
					title={`${blocker.ownerLabel || blocker.ownerId} · ${translator.textFn("Artwork")}`}
					usage={blocker}
				/>
			);
	}
	return (
		<EditorArtworkUsageRow
			dataUi="EditorArtworkDeleteBlocker"
			project={project}
			title={`${translator.textFn("Project")} · ${translator.textFn("Artwork")}`}
			usage={blocker}
		/>
	);
};

interface EditorArtworkDeleteSectionProps extends useEditorArtworkDeleteController.Props {}

/** Explains artwork-delete eligibility and exposes the guarded destructive action. */
export const EditorArtworkDeleteSection = ({
	filter,
	query,
	resourceId,
}: EditorArtworkDeleteSectionProps) => {
	const translator = useTranslator();
	const controller = useEditorArtworkDeleteController({
		filter,
		query,
		resourceId,
	});
	const blocked = controller.blockers.length > 0;
	return (
		<>
			<section
				className="grid gap-3"
				data-ui="EditorArtworkDeleteSection"
			>
				<Status
					action={
						blocked ? undefined : (
							<DangerButton
								data-ui="EditorArtworkDeleteOpen"
								onClick={controller.openFn}
							>
								<Tx label="Delete artwork" />
							</DangerButton>
						)
					}
					dataUi="EditorArtworkDeleteState"
					description={
						blocked ? (
							`${controller.blockers.length} ${translator.textFn(
								controller.blockers.length === 1
									? "reference must be removed first."
									: "references must be removed first.",
							)}`
						) : (
							<Mx label="Artwork delete available description" />
						)
					}
					icon={blocked ? ShieldAlert : ShieldCheck}
					size="large"
					title={translator.textFn(
						blocked
							? "This artwork cannot be deleted yet"
							: "This artwork can be deleted",
					)}
					variant="flat"
				/>

				{blocked ? (
					<div
						className="ak-list grid gap-2"
						data-ui="EditorArtworkDeleteBlockers"
					>
						{controller.blockers.map((blocker) => (
							<EditorArtworkDeleteBlockerLink
								blocker={blocker}
								key={blocker.path.join(".")}
								project={controller.project}
							/>
						))}
					</div>
				) : null}
			</section>
			{controller.confirming ? (
				<EditorArtworkDeleteDialog
					error={controller.error}
					pending={controller.deleting}
					resourceId={resourceId}
					onCancelFn={controller.cancelFn}
					onConfirmFn={() => void controller.confirmFn()}
				/>
			) : null}
		</>
	);
};
