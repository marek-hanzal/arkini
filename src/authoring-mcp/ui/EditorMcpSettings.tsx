import type { EditorMcpOverviewSchema } from "~electron/contract/editor/EditorMcpOverviewSchema";

import { Button, PrimaryButton } from "~/ui/ui/Button";
import { EditorMcpCopyableUrl } from "./EditorMcpCopy";
import { EditorMcpStatus } from "./EditorMcpStatus";

const editorMcpInputClassName =
	"w-full rounded-lg border border-line bg-surface px-3 py-2 text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60";

interface EditorMcpSettingsProps {
	readonly authtoken: string;
	readonly copied?: string;
	readonly ngrokDomain: string;
	readonly onCopy: (key: string, value: string) => Promise<void>;
	readonly onSaveNgrok: () => void;
	readonly onSavePort: () => void;
	readonly onSetAuthtoken: (value: string) => void;
	readonly onSetNgrokDomain: (value: string) => void;
	readonly onSetPort: (value: string) => void;
	readonly overview: EditorMcpOverviewSchema.Type;
	readonly pending: boolean;
	readonly port: string;
}

export const EditorMcpSettings = ({
	authtoken,
	copied,
	ngrokDomain,
	onCopy,
	onSaveNgrok,
	onSavePort,
	onSetAuthtoken,
	onSetNgrokDomain,
	onSetPort,
	overview,
	pending,
	port,
}: EditorMcpSettingsProps) => {
	const configuredDomain = overview.ngrokDomain;
	const remoteRunning = overview.remote.type === "ready" || overview.remote.type === "starting";
	const portDisabled =
		pending || overview.local.type === "ready" || overview.remote.type === "ready";
	const ngrokDisabled = pending || remoteRunning;
	const localUrl = `http://127.0.0.1:${port}/editor/mcp`;
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
						value={port}
						className={editorMcpInputClassName}
						disabled={portDisabled}
						onChange={(event) => onSetPort(event.currentTarget.value)}
					/>
				</label>
				<Button
					className="justify-self-start"
					disabled={pending}
					onClick={onSavePort}
				>
					Save port
				</Button>
				<EditorMcpCopyableUrl
					copied={copied === "local-url"}
					label="Local endpoint"
					onCopy={() => void onCopy("local-url", localUrl)}
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
						value={ngrokDomain}
						className={editorMcpInputClassName}
						disabled={ngrokDisabled}
						placeholder="your-assigned-name.ngrok-free.app"
						onChange={(event) => onSetNgrokDomain(event.currentTarget.value)}
					/>
				</label>
				<label className="grid gap-2">
					<span className="text-sm font-semibold">Authtoken</span>
					<input
						type="password"
						value={authtoken}
						className={editorMcpInputClassName}
						disabled={ngrokDisabled}
						placeholder={
							configuredDomain === undefined
								? "Paste ngrok authtoken"
								: "Configured — paste to replace"
						}
						onChange={(event) => onSetAuthtoken(event.currentTarget.value)}
					/>
				</label>
				<PrimaryButton
					className="justify-self-start"
					disabled={ngrokDisabled}
					onClick={onSaveNgrok}
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
