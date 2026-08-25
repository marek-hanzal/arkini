import { PrimaryButton } from "~/ui/button/Button";
import type { EditorMcpController } from "~/ui/editor-mcp/useEditorMcpController";
import { EditorMcpStatus, editorMcpInputClassName } from "./EditorMcpStatus";

export const EditorMcpTunnelSettings = ({
	controller,
}: {
	readonly controller: EditorMcpController;
}) => {
	const status = controller.overview?.ngrokDomain;
	const message =
		status !== undefined
			? `Domain: ${status}`
			: controller.overview?.ngrokConfigured
				? "Authtoken configured. Domain will be discovered on first Remote MCP start."
				: "ngrok is not configured.";
	return (
		<div className="grid gap-4">
			<div className="ak-list-row grid gap-3 rounded-xl border border-line p-5">
				<div>
					<h2 className="font-semibold">ngrok</h2>
					<p className="mt-1 text-sm text-muted">
						Paste an ngrok authtoken once. Arkini stores it locally and discovers the
						account's stable development domain on first start.
					</p>
				</div>
				<label className="grid gap-2">
					<span className="text-sm font-semibold">Authtoken</span>
					<input
						type="password"
						value={controller.authtoken}
						className={editorMcpInputClassName}
						disabled={
							controller.pending || controller.overview?.remote.type === "ready"
						}
						placeholder={
							controller.overview?.ngrokConfigured
								? "Configured — paste to replace"
								: "Paste ngrok authtoken"
						}
						onChange={(event) => controller.setAuthtoken(event.currentTarget.value)}
					/>
				</label>
				<PrimaryButton
					className="justify-self-start"
					disabled={controller.pending}
					onClick={controller.saveAuthtoken}
				>
					Save authtoken
				</PrimaryButton>
				<EditorMcpStatus
					message={message}
					tone={controller.overview?.ngrokConfigured ? "success" : "muted"}
				/>
			</div>
		</div>
	);
};
