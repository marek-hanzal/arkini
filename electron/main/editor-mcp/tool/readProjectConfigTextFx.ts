import { Effect } from "effect";

import type { EditorProject } from "~/editor/EditorProject";

/** Returns the complete non-item authoring config promised as JSON by project_config. */
export const readProjectConfigTextFx = Effect.fn("readProjectConfigTextFx")(
	(project: EditorProject) =>
		Effect.succeed(
			JSON.stringify(
				{
					projectId: project.projectId,
					revision: project.revision,
					version: project.version,
					config: {
						meta: project.config.meta,
						resources: project.config.resources,
						start: project.config.start,
					},
				},
				null,
				2,
			),
		),
);
