/** Stable scene API: checked inputs, responsive geometry and seekable timing. */
export {
    type SceneItem,
    type SceneStep,
    type SceneInput,
    type Item,
    type Connection,
    type SceneModel,
    type PlacedItem,
    type Route,
    type Layout,
} from "#src/figures/scene/types.ts";
export { characters } from "#src/figures/scene/text.ts";
export { decodeScene, defineScene } from "#src/figures/scene/decode.ts";
export { layoutScene } from "#src/figures/scene/layout.ts";
export { SCENE_DURATION, sceneState } from "#src/figures/scene/timeline.ts";
