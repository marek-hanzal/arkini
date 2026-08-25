import type { EditorProjectVersionDescriptor } from "~/editor/version/EditorProjectVersion";
import { Button, DangerButton } from "~/ui/button/Button";
import { editorInputClassName } from "~/ui/form/EditorInputClassName";
import { EditorVersionCheckoutDialog } from "~/ui/version/editor/EditorVersionCheckoutDialog";
import { EditorVersionDiff } from "~/ui/version/editor/EditorVersionDiff";
import { EditorVersionGraph } from "~/ui/version/editor/EditorVersionGraph";
import { useEditorVersionHistoryController } from "~/ui/version/editor/useEditorVersionHistoryController";

const EditorVersionReferenceSelect = ({
	label,
	onChange,
	value,
	versions,
}: {
	readonly label: string;
	readonly onChange: (value: string) => void;
	readonly value: string;
	readonly versions: ReadonlyArray<EditorProjectVersionDescriptor>;
}) => (
	<label className="grid gap-1 text-xs font-semibold">
		{label}
		<select
			className={editorInputClassName}
			value={value}
			onChange={(event) => onChange(event.currentTarget.value)}
		>
			<option value="current">Working copy</option>
			{versions.map((version) => (
				<option
					key={version.versionId}
					disabled={version.applicability.type === "incompatible"}
					value={version.versionId}
				>
					{version.subject}
				</option>
			))}
		</select>
	</label>
);

export const EditorVersionHistory = () => {
	const controller = useEditorVersionHistoryController();
	const versions = controller.history?.versions ?? [];
	return (
		<div
			className="grid h-full min-h-0 lg:grid-cols-[minmax(20rem,0.85fr)_minmax(24rem,1.15fr)]"
			data-ui="EditorVersionHistory"
		>
			<section className="min-h-0 overflow-y-auto border-r border-line">
				{controller.history === undefined || controller.graph === undefined ? (
					<p className="p-4 text-sm text-muted">Reading version history…</p>
				) : (
					<EditorVersionGraph
						layout={controller.graph}
						onSelect={controller.selectVersion}
						selectedVersionId={controller.selected?.versionId}
						status={controller.history.status}
					/>
				)}
			</section>
			<section className="min-h-0 overflow-y-auto p-4">
				<div className="grid gap-5">
					{controller.error === undefined ? null : (
						<p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
							{controller.error}
						</p>
					)}
					{controller.selected === undefined ? (
						<p className="text-sm text-muted">Create or select a saved version.</p>
					) : (
						<article className="grid gap-4 rounded-2xl border border-line bg-surface-raised/60 p-5">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="min-w-0">
									<h2 className="break-words text-lg font-semibold">
										{controller.selected.subject}
									</h2>
									<p className="mt-1 text-xs text-muted">
										Arkini {controller.selected.arkini} · Arkpack{" "}
										{controller.selected.arkpackVersion}· source revision{" "}
										{controller.selected.sourceRevision}
									</p>
								</div>
								<DangerButton
									disabled={
										controller.checkoutPending ||
										controller.selected.applicability.type === "incompatible"
									}
									cursorIntent={
										controller.checkoutPending ? "progress" : undefined
									}
									onClick={controller.restoreSelected}
								>
									{controller.checkoutPending ? "Restoring…" : "Restore version"}
								</DangerButton>
							</div>
							{controller.selected.applicability.type === "incompatible" ? (
								<p className="rounded-lg bg-warning/10 p-3 text-sm text-warning">
									{controller.selected.applicability.reason}
								</p>
							) : null}
							{controller.selected.body === undefined ? null : (
								<p className="whitespace-pre-wrap text-sm leading-6 text-muted">
									{controller.selected.body}
								</p>
							)}
							<label className="grid gap-1.5 text-sm">
								<span className="font-semibold">Tag</span>
								<div className="flex gap-2">
									<input
										className={editorInputClassName}
										disabled={
											controller.selected.applicability.type ===
											"incompatible"
										}
										maxLength={80}
										placeholder="No tag"
										value={controller.tagDraft}
										onChange={(event) =>
											controller.setTagDraft(event.currentTarget.value)
										}
									/>
									<Button
										disabled={
											controller.tagPending ||
											controller.selected.applicability.type ===
												"incompatible"
										}
										onClick={controller.saveTag}
									>
										{controller.tagPending ? "Saving…" : "Save tag"}
									</Button>
								</div>
							</label>
						</article>
					)}
					<article className="grid gap-4 rounded-2xl border border-line bg-surface-raised/60 p-5">
						<div>
							<h3 className="font-semibold">Compare</h3>
							<p className="mt-1 text-xs text-muted">
								Select the working copy or any applicable saved version on either
								side.
							</p>
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<EditorVersionReferenceSelect
								label="Before"
								onChange={controller.setCompareFrom}
								value={controller.compareFrom}
								versions={versions}
							/>
							<EditorVersionReferenceSelect
								label="After"
								onChange={controller.setCompareTo}
								value={controller.compareTo}
								versions={versions}
							/>
						</div>
						{controller.diffPending ? (
							<p className="text-sm text-muted">Comparing…</p>
						) : controller.diff === undefined ? null : (
							<EditorVersionDiff diff={controller.diff} />
						)}
					</article>
				</div>
			</section>
			{controller.confirmVersion === undefined ? null : (
				<EditorVersionCheckoutDialog
					onCancel={controller.cancelCheckout}
					onCommit={controller.goToCommit}
					onRestore={controller.confirmCheckout}
					pending={controller.checkoutPending}
					version={controller.confirmVersion}
				/>
			)}
		</div>
	);
};
