// Installs Pixi's static shader/uniform synchronizers before the renderer graph
// is evaluated so Electron can keep its strict no-unsafe-eval CSP.
import "pixi.js/unsafe-eval";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { bootstrapRendererFx } from "~/renderer-bootstrap/ui/bootstrapRendererFx";
import "~/launcher/ui/launcher.css";
import "~/main.css";

void RendererRuntime.runPromise(bootstrapRendererFx()).catch((cause) => {
	console.error("Arkini renderer fatal surface could not render.", cause);
});
