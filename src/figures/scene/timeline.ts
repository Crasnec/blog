import type { SceneModel } from "./types.ts";

export const SCENE_DURATION = 8;

export function sceneState(model: SceneModel, time: number) {
    const span = 5.6 / Math.max(1, model.steps.length);
    const position = Math.max(0, (time - 0.8) / span);
    const active = time >= 0.8 && position < model.steps.length ? Math.floor(position) : -1;
    const index = Math.min(model.steps.length - 1, Math.floor(position));
    const step = time >= 0.8 ? model.steps[index] : undefined;
    const target = step?.action === "transfer" ? step.to : step?.target;
    const revealed = new Set(
        model.steps.flatMap((s, i) => (i < position && s.action === "reveal" ? [s.target] : [])),
    );
    return { active, step, target, progress: active < 0 ? 1 : position - active, revealed };
}
