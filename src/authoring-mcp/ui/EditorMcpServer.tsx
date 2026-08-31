import { RefreshCw } from "lucide-react";
import { match } from "ts-pattern";
import type { EditorMcpOverviewSchema } from "../../../electron/contract/editor/EditorMcpOverviewSchema";

import { Button, DangerButton, PrimaryButton } from "~/ui/ui/Button";
import { EditorMcpCopyableUrl, EditorMcpCopyButton } from "./EditorMcpCopy";
import { EditorMcpStatus, type EditorMcpStatusTone } from "./EditorMcpStatus";

const readLocalStatusFn = (
	status: EditorMcpOverviewSchema.Type["local"],
): {
	readonly message: string;
	readonly tone: EditorMcpStatusTone;
} =>
	match(status)
		.with(
			{
				type: "ready",
			},
			({ port }) => ({
				message: `Running on port ${port}.`,
				tone: "success" as const,
			}),
		)
		.with(
			{
				type: "unavailable",
			},
			({ message }) => ({
				message,
				tone: "danger" as const,
			}),
		)
		.otherwise(() => ({
			message: "Stopped.",
			tone: "muted" as const,
		}));

const readRemoteStatusFn = (
	status: EditorMcpOverviewSchema.Type["remote"],
): {
	readonly message: string;
	readonly tone: EditorMcpStatusTone;
} =>
	match(status)
		.with(
			{
				type: "ready",
			},
			({ url }) => ({
				message: `Running at ${url}`,
				tone: "success" as const,
			}),
		)
		.with(
			{
				type: "starting",
			},
			() => ({
				message: "Starting tunnel and checking OAuth…",
				tone: "muted" as const,
			}),
		)
		.with(
			{
				type: "unavailable",
			},
			({ message }) => ({
				message,
				tone: "danger" as const,
			}),
		)
		.otherwise(() => ({
			message: "Stopped.",
			tone: "muted" as const,
		}));

interface EditorMcpServerProps {
	readonly copied?: string;
	readonly onCopy: (key: string, value: string) => Promise<void>;
	readonly onResetAuth: () => void;
	readonly onStartLocal: () => void;
	readonly onStartRemote: () => void;
	readonly onStopLocal: () => void;
	readonly onStopRemote: () => void;
	readonly overview: EditorMcpOverviewSchema.Type;
	readonly pending: boolean;
}

export const EditorMcpServer = ({
	copied,
	onCopy,
	onResetAuth,
	onStartLocal,
	onStartRemote,
	onStopLocal,
	onStopRemote,
	overview,
	pending,
}: EditorMcpServerProps) => {
	const localStatus = readLocalStatusFn(overview.local);
	const remoteStatus = readRemoteStatusFn(overview.remote);
	const localUrl =
		overview.local.type === "ready"
			? `http://127.0.0.1:${overview.local.port}/editor/mcp`
			: undefined;
	const remoteUrl = overview.remote.type === "ready" ? overview.remote.url : undefined;
	const remotePasswordCopyKey = `remote-password:${overview.remotePassword ?? ""}`;
	return (
		<div className="grid gap-4">
			{overview.remotePassword === undefined ? null : (
				<div
					className="grid gap-3 rounded-xl border border-accent bg-accent/10 p-5"
					data-ui="EditorMcpRemotePassword"
				>
					<h2 className="font-semibold">Remote password</h2>
					<p className="text-sm text-muted">
						Enter this password on the Arkini authorization page when a Remote MCP
						client connects. Generating a new password stops Remote MCP and disconnects
						existing clients.
					</p>
					<div className="flex min-w-0 items-stretch gap-2">
						<div className="relative min-w-0 flex-1">
							<input
								readOnly
								value={overview.remotePassword}
								className="h-full min-w-0 w-full rounded-lg border border-line bg-surface px-3 py-2 pr-10 text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60"
							/>
							<div className="absolute right-2 top-1/2 -translate-y-1/2 text-muted">
								<EditorMcpCopyButton
									copied={copied === remotePasswordCopyKey}
									onCopy={() =>
										void onCopy(
											remotePasswordCopyKey,
											overview.remotePassword ?? "",
										)
									}
									title="Copy password"
								/>
							</div>
						</div>
						<DangerButton
							className="shrink-0 gap-2"
							disabled={pending}
							onClick={onResetAuth}
						>
							<RefreshCw className="size-4" />
							Refresh
						</DangerButton>
					</div>
				</div>
			)}
			<div className="ak-list-row grid gap-5 rounded-xl border border-line p-5">
				<div className="grid gap-3">
					<div>
						<h2 className="font-semibold">Local MCP</h2>
						<p className="mt-1 text-sm text-muted">
							Open only on loopback for Codex and other local tools.
						</p>
					</div>
					{overview.local.type === "ready" ? (
						<Button
							disabled={pending}
							onClick={onStopLocal}
						>
							Stop Local MCP
						</Button>
					) : (
						<PrimaryButton
							disabled={pending}
							onClick={onStartLocal}
						>
							Start Local MCP
						</PrimaryButton>
					)}
					{localUrl === undefined ? (
						<EditorMcpStatus
							message={localStatus.message}
							tone={localStatus.tone}
						/>
					) : (
						<EditorMcpCopyableUrl
							copied={copied === "local-url"}
							label="Running at"
							onCopy={() => void onCopy("local-url", localUrl)}
							url={localUrl}
						/>
					)}
				</div>
				<div className="grid gap-3 border-t border-line pt-5">
					<div>
						<h2 className="font-semibold">Remote MCP</h2>
						<p className="mt-1 text-sm text-muted">
							OAuth-protected public access through the configured ngrok tunnel.
						</p>
					</div>
					{overview.remote.type === "ready" ? (
						<Button
							disabled={pending}
							onClick={onStopRemote}
						>
							Stop Remote MCP
						</Button>
					) : (
						<PrimaryButton
							disabled={pending || overview.ngrokDomain === undefined}
							onClick={onStartRemote}
						>
							Start Remote MCP
						</PrimaryButton>
					)}
					{remoteUrl === undefined ? (
						<EditorMcpStatus
							message={remoteStatus.message}
							tone={remoteStatus.tone}
						/>
					) : (
						<EditorMcpCopyableUrl
							copied={copied === "remote-url"}
							label="Running at"
							onCopy={() => void onCopy("remote-url", remoteUrl)}
							url={remoteUrl}
						/>
					)}
				</div>
			</div>
		</div>
	);
};
