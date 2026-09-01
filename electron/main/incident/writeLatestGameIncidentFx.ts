import { Effect } from "effect";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { GameIncidentWrite } from "~electron/contract/incident/GameIncidentWrite";
import { GameIncidentFiles } from "~shared/GameIncidentMetadata";

export namespace writeLatestGameIncidentFx {
	export interface Props {
		readonly incidentsRoot: string;
		readonly incident: GameIncidentWrite;
	}
}

/** Overwrites the one disposable failed-session environment exposed to local tooling. */
export const writeLatestGameIncidentFx = Effect.fn("writeLatestGameIncidentFx")(
	({ incidentsRoot, incident }: writeLatestGameIncidentFx.Props) =>
		Effect.tryPromise({
			try: async () => {
				const directory = join(incidentsRoot, GameIncidentFiles.directory);
				await mkdir(directory, {
					recursive: true,
				});
				await writeFile(join(directory, GameIncidentFiles.arkpack), incident.arkpackBytes);
				await writeFile(join(directory, GameIncidentFiles.save), incident.saveBytes);
				await writeFile(
					join(directory, GameIncidentFiles.diagnostics),
					`${incident.diagnostics.map((record) => JSON.stringify(record)).join("\n")}\n`,
					"utf8",
				);
			},
			catch: (cause) => cause,
		}),
);
