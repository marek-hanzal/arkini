import { bootstrapFx } from "~/v0/play/fx/bootstrapFx";
import { runEffect } from "~/v0/fx/runEffect";

export const bootstrapDatabase = () => runEffect(bootstrapFx());
