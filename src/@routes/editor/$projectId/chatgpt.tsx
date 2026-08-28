import { createFileRoute } from "@tanstack/react-router";

import { Button } from "~/ui/button/Button";
import { EditorChatGptAssetConfirmation } from "~/ui/chatgpt/editor/EditorChatGptAssetConfirmation";
import { useEditorChatGptController } from "~/ui/chatgpt/editor/useEditorChatGptController";
import { Status } from "~/ui/status/Status";

export const Route = createFileRoute("/editor/$projectId/chatgpt")({
	component: () => {
		const controller = useEditorChatGptController();
		return (
			<div
				ref={controller.surfaceRef}
				className="h-full min-h-0 overflow-hidden bg-surface"
				data-ui="EditorChatGptSurface"
			>
				{controller.candidate === undefined ||
				controller.candidateError !== undefined ? null : (
					<EditorChatGptAssetConfirmation controller={controller} />
				)}
				{controller.candidateError === undefined ? null : (
					<div className="grid h-full place-items-center p-5">
						<Status
							dataUi="EditorChatGptCandidateRejected"
							description={
								controller.candidateError instanceof Error
									? controller.candidateError.message
									: String(controller.candidateError)
							}
							icon="icon-[lucide--file-warning]"
							title="Downloaded image was rejected"
							action={
								<Button onClick={controller.discard}>Discard &amp; return</Button>
							}
						/>
					</div>
				)}
				{controller.candidate === undefined &&
				controller.candidateError === undefined &&
				controller.viewState.type === "loading" ? (
					<div className="grid h-full place-items-center p-5">
						<Status
							dataUi="EditorChatGptLoading"
							description="The isolated browser is loading the next page."
							icon="icon-[lucide--loader-circle] animate-spin"
							title="Loading ChatGPT…"
						/>
					</div>
				) : null}
				{controller.candidate === undefined &&
				controller.candidateError === undefined &&
				controller.viewState.type === "unavailable" ? (
					<div className="grid h-full place-items-center p-5">
						<Status
							dataUi="EditorChatGptUnavailable"
							description={controller.viewState.message}
							icon="icon-[lucide--cloud-off]"
							title="ChatGPT is unavailable"
							action={<Button onClick={controller.retry}>Retry</Button>}
						/>
					</div>
				) : null}
			</div>
		);
	},
});
