import { Button, DangerButton, PrimaryButton } from "~/ui/button/Button";
import { editorInputClassName } from "~/ui/form/EditorInputClassName";
import type { useEditorChatGptController } from "~/chatgpt-asset-authoring/ui/useEditorChatGptController";

export const EditorChatGptAssetConfirmation = ({
	controller,
}: {
	readonly controller: useEditorChatGptController.Output;
}) => {
	const candidate = controller.candidate;
	if (candidate === undefined || controller.previewUrl === undefined) return null;
	const error =
		controller.error === undefined
			? undefined
			: controller.error instanceof Error
				? controller.error.message
				: String(controller.error);
	return (
		<section
			className="grid h-full min-h-0 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,30rem)] lg:gap-5"
			data-ui="EditorChatGptAssetConfirmation"
		>
			<div className="grid min-h-72 place-items-center overflow-hidden rounded-2xl border border-line bg-canvas/70 p-5">
				<img
					src={controller.previewUrl}
					alt={`${candidate.filename} preview`}
					className="max-h-[calc(100vh-8rem)] max-w-full object-contain"
					draggable={false}
				/>
			</div>
			<div className="grid content-start gap-4 rounded-2xl border border-line bg-surface/80 p-5">
				<div className="grid gap-1">
					<p className="text-xs font-semibold tracking-wide text-subtle uppercase">
						ChatGPT download
					</p>
					<h1 className="text-xl font-semibold text-foreground">Save image as asset</h1>
					<p className="truncate text-sm text-muted">{candidate.filename}</p>
				</div>
				<label className="grid gap-1.5 text-sm font-semibold text-foreground">
					Asset ID
					<input
						className={editorInputClassName}
						value={controller.resourceId}
						disabled={controller.candidateValidating || controller.saving}
						onChange={(event) => controller.setResourceId(event.currentTarget.value)}
					/>
				</label>
				{controller.collision ? (
					<p
						className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning"
						data-ui="EditorChatGptAssetCollision"
					>
						{controller.replacementApproved
							? `Replace existing asset ${controller.resourceId.trim()}? This cannot be undone.`
							: `Asset ${controller.resourceId.trim()} already exists. Confirm once more to replace it.`}
					</p>
				) : null}
				{error === undefined ? null : (
					<p
						className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
						data-ui="EditorChatGptAssetError"
					>
						{error}
					</p>
				)}
				<div className="flex flex-wrap gap-2 pt-1">
					<Button
						disabled={controller.saving}
						onClick={controller.discard}
					>
						Discard &amp; return
					</Button>
					{controller.replacementApproved ? (
						<DangerButton
							disabled={
								controller.candidateValidating ||
								controller.saving ||
								controller.resourceId.trim().length === 0
							}
							cursorIntent={controller.saving ? "progress" : undefined}
							onClick={() => void controller.save()}
						>
							Replace asset
						</DangerButton>
					) : (
						<PrimaryButton
							disabled={
								controller.candidateValidating ||
								controller.saving ||
								controller.resourceId.trim().length === 0
							}
							cursorIntent={controller.saving ? "progress" : undefined}
							onClick={() => void controller.save()}
						>
							Save &amp; return
						</PrimaryButton>
					)}
				</div>
			</div>
		</section>
	);
};
