import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { RefreshCw } from "lucide-react";
import { match } from "ts-pattern";
import type { EditorMcpOverviewSchema } from "~/authoring-mcp/schema/EditorMcpOverviewSchema";

import { Button, DangerButton, PrimaryButton } from "~/ui/ui/Button";
import { CopyButton } from "~/ui/ui/CopyButton";
import { EditorMcpCopyableUrl } from "./EditorMcpCopyableUrl";
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
	readonly onResetAuthFn: () => void;
	readonly onStartLocalFn: () => void;
	readonly onStartRemoteFn: () => void;
	readonly onStopLocalFn: () => void;
	readonly onStopRemoteFn: () => void;
	readonly overview: EditorMcpOverviewSchema.Type;
	readonly pending: boolean;
}

export const EditorMcpServer = ({
	onResetAuthFn,
	onStartLocalFn,
	onStartRemoteFn,
	onStopLocalFn,
	onStopRemoteFn,
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
	return (
		<div className="grid gap-4">
			{overview.remotePassword === undefined ? null : (
				<EditorRootCard
					className="gap-3"
					dataUi="EditorMcpRemotePassword"
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
								className="h-full min-w-0 w-full rounded-lg border border-control-border bg-[var(--ak-editor-background)] px-3 py-2 pr-10 text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60"
							/>
							<div className="absolute right-2 top-1/2 -translate-y-1/2 text-muted">
								<CopyButton
									value={overview.remotePassword}
									title="Copy password"
								/>
							</div>
						</div>
						<DangerButton
							className="shrink-0 gap-2"
							disabled={pending}
							onClick={onResetAuthFn}
						>
							<RefreshCw className="size-4" />
							Refresh
						</DangerButton>
					</div>
				</EditorRootCard>
			)}
			<EditorRootCard dataUi="EditorMcpTransportsCard">
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
							onClick={onStopLocalFn}
						>
							Stop Local MCP
						</Button>
					) : (
						<PrimaryButton
							disabled={pending}
							onClick={onStartLocalFn}
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
							label="Running at"
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
							onClick={onStopRemoteFn}
						>
							Stop Remote MCP
						</Button>
					) : (
						<PrimaryButton
							disabled={pending || overview.ngrokDomain === undefined}
							onClick={onStartRemoteFn}
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
							label="Running at"
							url={remoteUrl}
						/>
					)}
				</div>
			</EditorRootCard>
		</div>
	);
};
