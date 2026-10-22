import type { LessonBlock } from "./types";

type Tree = Extract<LessonBlock, { type: "decisionTree" }>;
/** A bounded, explicit path; no score, no persisted cursor requirement. */
export function resolveDecisionTree(block: Tree, path: readonly string[]) {
  let node = block.nodes.find((item) => item.id === block.startId);
  const visited = new Set<string>();
  for (const id of path) {
    if (!node || !("choices" in node) || visited.has(node.id)) return undefined;
    visited.add(node.id);
    const nextId = node.choices.find((choice) => choice.id === id)?.nextId;
    node = block.nodes.find((item) => item.id === nextId);
  }
  return node && !visited.has(node.id) ? node : undefined;
}
