import { hardResetFx } from "../fx/hardResetFx";
import { runEffect } from "./runEffect";

export const hardResetDatabaseFile = () => runEffect(hardResetFx());
