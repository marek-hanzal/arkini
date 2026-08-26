import { Button } from "~/ui/button/Button";
import type { EditorMcpController } from "~/ui/editor-mcp/useEditorMcpController";
import { EditorMcpCopyableUrl, editorMcpInputClassName } from "./EditorMcpStatus";

export const EditorMcpMcpSettings = ({
	controller,
}: {
	readonly controller: EditorMcpController;
}) => {
	const localUrl = `http://127.0.0.1:${controller.port}/editor/mcp`;
	return (
		<div className="grid gap-4">
			<div className="ak-list-row grid gap-3 rounded-xl border border-line p-5">
				<div>
					<h2 className="font-semibold">Local server</h2>
					<p className="mt-1 text-sm text-muted">
						The open local endpoint is intended for trusted tools running on this
						computer.
					</p>
				</div>
				<label className="grid gap-2">
					<span className="text-sm font-semibold">Port</span>
					<input
						type="number"
						min={1_024}
						max={65_535}
						value={controller.port}
						className={editorMcpInputClassName}
						disabled={
							controller.pending ||
							controller.overview?.local.type === "ready" ||
							controller.overview?.remote.type === "ready"
						}
						onChange={(event) => controller.setPort(event.currentTarget.value)}
					/>
				</label>
				<Button
					className="justify-self-start"
					disabled={controller.pending}
					onClick={controller.savePort}
				>
					Save port
				</Button>
				<EditorMcpCopyableUrl
					copied={controller.copied === "local-url"}
					label="Local endpoint"
					onCopy={() => void controller.copy("local-url", localUrl)}
					url={localUrl}
				/>
			</div>
		</div>
	);
};
