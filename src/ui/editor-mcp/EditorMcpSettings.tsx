import { Button, PrimaryButton } from "~/ui/button/Button";
import type { EditorMcpController } from "~/ui/editor-mcp/useEditorMcpController";
import { EditorMcpCopyableUrl, EditorMcpStatus, editorMcpInputClassName } from "./EditorMcpStatus";

export const EditorMcpSettings = ({ controller }: { readonly controller: EditorMcpController }) => {
	const configuredDomain = controller.overview?.ngrokDomain;
	const remoteRunning =
		controller.overview?.remote.type === "ready" ||
		controller.overview?.remote.type === "starting";
	const portDisabled =
		controller.pending ||
		controller.overview?.local.type === "ready" ||
		controller.overview?.remote.type === "ready";
	const ngrokDisabled = controller.pending || remoteRunning;
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
						disabled={portDisabled}
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
						disabled={ngrokDisabled}
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
						disabled={ngrokDisabled}
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
					disabled={ngrokDisabled}
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
