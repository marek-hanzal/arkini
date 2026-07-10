import { Link, Outlet } from "@tanstack/react-router";
import type { FC } from "react";

import { useDevGamePack } from "../pack/hook/useDevGamePack";

const navLinkClassName =
	"rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 [&.active]:bg-slate-800 [&.active]:text-white";

export const DevShell: FC = () => {
	const { config, fileName } = useDevGamePack();

	return (
		<div className="min-h-dvh bg-slate-950 text-slate-100">
			<header className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-xl">
				<div className="mx-auto flex max-w-[1600px] items-center justify-between gap-5 px-4 py-3 sm:px-6 lg:px-8">
					<div className="min-w-0">
						<Link
							to="/dev"
							className="font-semibold tracking-tight text-white"
						>
							Arkini Dev
						</Link>
						<p className="truncate text-xs text-slate-500">
							{config ? `${config.meta.title} · ${fileName}` : "No game pack loaded"}
						</p>
					</div>
					<nav className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/70 p-1">
						<Link
							to="/dev"
							activeOptions={{
								exact: true,
							}}
							className={navLinkClassName}
						>
							Pack
						</Link>
						<Link
							to="/dev/table"
							className={navLinkClassName}
						>
							Table
						</Link>
						<Link
							to="/dev/flow"
							className={navLinkClassName}
						>
							Flow
						</Link>
					</nav>
				</div>
			</header>
			<Outlet />
		</div>
	);
};
