import { PrimaryButton } from "~/ui/button/Button";
import type { EditorMcpController } from "~/ui/editor-mcp/useEditorMcpController";
import { EditorMcpStatus, editorMcpInputClassName } from "./EditorMcpStatus";

export const EditorMcpTunnelSettings = ({
	controller,
}: {
	readonly controller: EditorMcpController;
}) => {
	const configuredDomain = controller.overview?.ngrokDomain;
	const remoteRunning =
		controller.overview?.remote.type === "ready" ||
		controller.overview?.remote.type === "starting";
	const disabled = controller.pending || remoteRunning;
	return (
		<div className="grid gap-4">
			<div className="ak-list-row grid gap-3 rounded-xl border border-line p-5">
				<div>
					<h2 className="font-semibold">ngrok</h2>
					<p className="mt-1 text-sm text-muted">
						Paste your authtoken and assigned Development Domain. Arkini stores both
						locally and reuses the same public HTTPS address whenever Remote MCP starts.
					</p>
				</div>
				<label className="grid gap-2">
					<span className="text-sm font-semibold">Development domain</span>
					<input
						value={controller.ngrokDomain}
						className={editorMcpInputClassName}
						disabled={disabled}
						placeholder="your-assigned-name.ngrok-free.app"
						onChange={(event) => controller.setNgrokDomain(event.currentTarget.value)}
					/>
				</label>
				<label className="grid gap-2">
					<span className="text-sm font-semibold">Authtoken</span>
					<input
						type="password"
						value={controller.authtoken}
						className={editorMcpInputClassName}
						disabled={disabled}
						placeholder={
							configuredDomain === undefined
								? "Paste ngrok authtoken"
								: "Configured — paste to replace"
						}
						onChange={(event) => controller.setAuthtoken(event.currentTarget.value)}
					/>
				</label>
				<PrimaryButton
					className="justify-self-start"
					disabled={disabled}
					onClick={controller.saveNgrok}
				>
					Save ngrok configuration
				</PrimaryButton>
				<EditorMcpStatus
					message={
						configuredDomain === undefined
							? "ngrok is not configured."
							: `Configured for ${configuredDomain}.`
					}
					tone={configuredDomain === undefined ? "muted" : "success"}
				/>
			</div>
		</div>
	);
};
