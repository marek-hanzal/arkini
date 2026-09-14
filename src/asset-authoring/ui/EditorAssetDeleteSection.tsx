import { useTranslator } from "~/translation/ui/useTranslator";
import { Tx } from "~/translation/ui/Tx";
import { Mx } from "~/translation/ui/Mx";
import { ShieldAlert, ShieldCheck } from "lucide-react";

import type { Project } from "~/project-authoring/type/Project";
import type { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import { Button, DangerButton } from "~/ui/ui/Button";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorAssetDeleteController } from "~/asset-authoring/ui/useEditorAssetDeleteController";
import { EditorAssetUsageRow } from "~/asset-authoring/ui/EditorAssetUsageRow";
import { Status } from "~/ui/ui/Status";

const EditorAssetDeleteError = ({ error }: { readonly error: unknown }) =>
	error === undefined ? null : (
		<p className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
			{error instanceof Error ? error.message : String(error)}
		</p>
	);

const EditorAssetDeleteDialog = ({
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
	<div className="fixed inset-0 z-[100] grid place-items-center bg-overlay/95 p-[var(--ak-viewport-padding)]">
		<div
			className="w-full max-w-md rounded-2xl border border-line-strong bg-surface-raised p-6 text-foreground shadow-2xl"
			data-ui="EditorAssetDeleteDialog"
		>
			<h2 className="text-lg font-semibold">
				<Tx label="Delete asset?" />
			</h2>
			<p className="mt-2 text-sm leading-6 text-muted">
				<Tx label="Delete asset" />:{" "}
				<strong className="text-foreground">{resourceId}</strong>
			</p>
			<div className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm leading-6 text-danger">
				<Mx label="Asset delete confirmation warning" />
			</div>
			<p className="mt-2 text-xs text-subtle">
				<Tx label="Asset ID" />: {resourceId}
			</p>
			<EditorAssetDeleteError error={error} />
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
					data-ui="EditorAssetDeleteConfirm"
					onClick={onConfirmFn}
				>
					<Tx label="Delete asset" />
				</DangerButton>
			</div>
		</div>
	</div>
);

const EditorAssetDeleteBlockerLink = ({
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
				<EditorAssetUsageRow
					dataUi="EditorAssetDeleteBlocker"
					leading={
						<EditorItemThumbnail
							resourceIds={owner.asset.default}
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
		<EditorAssetUsageRow
			dataUi="EditorAssetDeleteBlocker"
			project={project}
			title={`${translator.textFn("Project")} · ${translator.textFn("Artwork")}`}
			usage={blocker}
		/>
	);
};

interface EditorAssetDeleteSectionProps extends useEditorAssetDeleteController.Props {}

/** Explains asset-delete eligibility and exposes the guarded destructive action. */
export const EditorAssetDeleteSection = ({
	filter,
	query,
	resourceId,
}: EditorAssetDeleteSectionProps) => {
	const translator = useTranslator();
	const controller = useEditorAssetDeleteController({
		filter,
		query,
		resourceId,
	});
	const blocked = controller.blockers.length > 0;
	return (
		<>
			<section
				className="grid gap-3"
				data-ui="EditorAssetDeleteSection"
			>
				<Status
					action={
						blocked ? undefined : (
							<DangerButton
								data-ui="EditorAssetDeleteOpen"
								onClick={controller.openFn}
							>
								<Tx label="Delete asset" />
							</DangerButton>
						)
					}
					dataUi="EditorAssetDeleteState"
					description={
						blocked ? (
							`${controller.blockers.length} ${translator.textFn(
								controller.blockers.length === 1
									? "reference must be removed first."
									: "references must be removed first.",
							)}`
						) : (
							<Mx label="Asset delete available description" />
						)
					}
					icon={blocked ? ShieldAlert : ShieldCheck}
					size="large"
					title={translator.textFn(
						blocked ? "This asset cannot be deleted yet" : "This asset can be deleted",
					)}
					variant="flat"
				/>

				{blocked ? (
					<div
						className="ak-list grid gap-2"
						data-ui="EditorAssetDeleteBlockers"
					>
						{controller.blockers.map((blocker) => (
							<EditorAssetDeleteBlockerLink
								blocker={blocker}
								key={blocker.path.join(".")}
								project={controller.project}
							/>
						))}
					</div>
				) : null}
			</section>
			{controller.confirming ? (
				<EditorAssetDeleteDialog
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
