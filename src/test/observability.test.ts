import { describe, it, expect } from "vitest";
import { groupPodsByWorkload, nodeInfo } from "@/lib/observability";
import type { ResourceNode } from "@/types/resource";
import { I15_NODES, I15_NS, I15_OAUTH_POD } from "./grafana-fixtures";

const names = (groups: ReturnType<typeof groupPodsByWorkload>) =>
  groups.map((g) => [g.workload?.name ?? null, g.pods.map((p) => p.name)]);

function pod(name: string, parent?: [string, string]): ResourceNode {
  return {
    kind: "Pod",
    name,
    namespace: I15_NS,
    version: "v1",
    ...(parent && { parentRefs: [{ kind: parent[0], name: parent[1], namespace: I15_NS }] }),
  };
}

describe("groupPodsByWorkload", () => {
  it("groups pods under their workload, through a ReplicaSet", () => {
    expect(names(groupPodsByWorkload(I15_NODES))).toEqual([
      ["i15-1-blueapi", ["i15-1-blueapi-0"]],
      ["i15-1-blueapi-oauth2", [I15_OAUTH_POD]],
    ]);
  });

  it("keeps workloads with no pods and puts unowned pods last", () => {
    const job = pod("backup-123-abcde", ["Job", "backup-123"]);
    const bare = pod("debug-shell");
    const groups = groupPodsByWorkload([I15_NODES[0], I15_NODES[1], job, bare]);
    expect(names(groups)).toEqual([
      ["i15-1-blueapi", []],
      ["i15-1-blueapi-oauth2", []],
      [null, ["backup-123-abcde", "debug-shell"]],
    ]);
  });

  it("does not match a same-named workload in another namespace", () => {
    const elsewhere = { ...pod("i15-1-blueapi-0"), namespace: "other",
      parentRefs: [{ kind: "StatefulSet", name: "i15-1-blueapi", namespace: "other" }] };
    expect(names(groupPodsByWorkload([I15_NODES[0], elsewhere]))).toEqual([
      ["i15-1-blueapi", []],
      [null, ["i15-1-blueapi-0"]],
    ]);
  });

  it("stops on owner cycles", () => {
    const a = { ...pod("a", ["ReplicaSet", "b"]), kind: "ReplicaSet" };
    const b = { ...pod("b", ["ReplicaSet", "a"]), kind: "ReplicaSet" };
    expect(names(groupPodsByWorkload([a, b, pod("p", ["ReplicaSet", "a"])]))).toEqual([
      [null, ["p"]],
    ]);
  });
});

describe("nodeInfo", () => {
  it("reads a named value from a node's info list", () => {
    const p = { ...pod("p"), info: [{ name: "Containers", value: "1/2" }] };
    expect(nodeInfo(p, "Containers")).toBe("1/2");
    expect(nodeInfo(p, "Node")).toBeUndefined();
  });
});
