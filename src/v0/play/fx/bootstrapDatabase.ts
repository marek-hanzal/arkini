import { bootstrapFx } from "../fx/bootstrapFx";
import { runEffect } from "./runEffect";

export const bootstrapDatabase = () => runEffect(bootstrapFx());
