import { describe, it, expect } from "vitest";
import {
  buildGraylogLinks,
  escapeLuceneRegex,
  graylogPodQuery,
  graylogRangeLabel,
  graylogUrl,
  resolveGraylogTemplate,
} from "@/lib/graylog";
import { GRAYLOG_CONFIG, GRAYLOG_SEARCH, I15_NODES, I15_OAUTH_POD } from "./grafana-fixtures";

/** Convert `field:/regex/` to a JS RegExp anchored like Lucene (whole term). */
function toRegExp(query: string): RegExp {
  const m = /^[a-z_]+:\/(.*)\/$/.exec(query);
  if (!m) throw new Error(`not a regex query: ${query}`);
  return new RegExp(`^${m[1]}$`);
}

function matcher(kind: string, name: string): RegExp {
  return toRegExp(graylogPodQuery(kind, name)!);
}

const PODS = [
  "i15-1-blueapi-0",
  "i15-1-blueapi-12",
  "i15-1-blueapi-oauth2-86d5bd8f5b-ngtpg",
  "i15-1-blueapi-oauth2-7d9f8b6c5-x2x4q",
  "i15-1-blueapi-oauth2-0",
  "i15-1-blueapi-x7k2p",
  "i15-1-blueapi-86d5bd8f5b-ngtpg",
  "i15-1-blueapi-oauth2-x7k2p",
];

const matching = (re: RegExp) => PODS.filter((p) => re.test(p));

describe("graylogPodQuery", () => {
  it("matches the user's reference formats", () => {
    expect(graylogPodQuery("StatefulSet", "i15-1-blueapi")).toBe("pod_name:/i15-1-blueapi-[0-9]+/");
    expect(graylogPodQuery("Deployment", "i15-1-blueapi-oauth2")).toBe(
      "pod_name:/i15-1-blueapi-oauth2-[a-z0-9]{1,10}-[a-z0-9]{5}/",
    );
    expect(graylogPodQuery("DaemonSet", "fluent-bit")).toBe("pod_name:/fluent-bit-[a-z0-9]{5}/");
  });

  it("StatefulSet matches only its ordinal pods, not a prefix-sharing sibling", () => {
    expect(matching(matcher("StatefulSet", "i15-1-blueapi"))).toEqual([
      "i15-1-blueapi-0",
      "i15-1-blueapi-12",
    ]);
  });

  it("Deployment matches replicaset-hash pods, not a prefix-sharing sibling", () => {
    // Known limit of the pattern: a DaemonSet named <name>-<word of up to 10
    // chars> has pods shaped like this Deployment's (here i15-1-blueapi-oauth2-x7k2p).
    expect(matching(matcher("Deployment", "i15-1-blueapi"))).toEqual([
      "i15-1-blueapi-86d5bd8f5b-ngtpg",
      "i15-1-blueapi-oauth2-x7k2p",
    ]);
    expect(matching(matcher("Deployment", "i15-1-blueapi-oauth2"))).toEqual([
      "i15-1-blueapi-oauth2-86d5bd8f5b-ngtpg",
      "i15-1-blueapi-oauth2-7d9f8b6c5-x2x4q",
    ]);
  });

  it("DaemonSet matches only its 5-char suffix pods", () => {
    expect(matching(matcher("DaemonSet", "i15-1-blueapi"))).toEqual(["i15-1-blueapi-x7k2p"]);
    expect(matching(matcher("DaemonSet", "i15-1-blueapi-oauth2"))).toEqual([
      "i15-1-blueapi-oauth2-x7k2p",
    ]);
  });

  it("escapes regex-special characters in the workload name", () => {
    expect(graylogPodQuery("StatefulSet", "a.b")).toBe("pod_name:/a\\.b-[0-9]+/");
    const re = matcher("StatefulSet", "a.b");
    expect(re.test("a.b-0")).toBe(true);
    expect(re.test("axb-0")).toBe(false);
    expect(escapeLuceneRegex("a/b+c")).toBe("a\\/b\\+c");
  });

  it("uses the configured pod field", () => {
    expect(graylogPodQuery("StatefulSet", "x", "kubernetes_pod_name")).toBe(
      "kubernetes_pod_name:/x-[0-9]+/",
    );
  });

  it("matches a bare pod by exact name and skips unknown kinds", () => {
    expect(graylogPodQuery("Pod", "debug-shell")).toBe('pod_name:"debug-shell"');
    expect(graylogPodQuery("ReplicaSet", "x")).toBeNull();
    expect(graylogPodQuery("Job", "x")).toBeNull();
  });
});

describe("graylogUrl", () => {
  it("URL-encodes the query into the template", () => {
    expect(
      graylogUrl(
        "https://graylog.example.com/search/abc?q={query}&rangetype=relative&from=7200",
        "pod_name:/i15-1-blueapi-[0-9]+/",
      ),
    ).toBe(
      "https://graylog.example.com/search/abc?q=pod_name%3A%2Fi15-1-blueapi-%5B0-9%5D%2B%2F&rangetype=relative&from=7200",
    );
  });

  it("round-trips the query through URLSearchParams", () => {
    const q = 'pod_name:/a\\.b-[a-z0-9]{1,10}-[a-z0-9]{5}/ "x" & y';
    const url = new URL(graylogUrl(GRAYLOG_CONFIG.urlTemplate!, q));
    expect(url.searchParams.get("q")).toBe(q);
    expect(url.searchParams.get("from")).toBe("7200");
  });
});

describe("graylogRangeLabel", () => {
  it.each([
    ["rangetype=relative&from=7200", "Last 2 hours"],
    ["rangetype=relative&from=3600", "Last hour"],
    ["rangetype=relative&from=86400", "Last day"],
    ["rangetype=relative&from=900", "Last 15 minutes"],
    ["rangetype=relative&relative=172800", "Last 2 days"],
    ["rangetype=relative&from=0", null],
    ["rangetype=absolute&from=2026-01-01", null],
    ["", null],
  ])("%s -> %s", (qs, label) => {
    expect(graylogRangeLabel(`https://g.example.com/search?q={query}&${qs}`)).toBe(label);
  });

  it("returns null for an unparseable template", () => {
    expect(graylogRangeLabel("not a url {query}")).toBeNull();
  });
});

describe("resolveGraylogTemplate", () => {
  it("requires enabled and a non-blank template", () => {
    expect(resolveGraylogTemplate(undefined)).toBeNull();
    expect(resolveGraylogTemplate({ enabled: false, urlTemplate: "https://g" })).toBeNull();
    expect(resolveGraylogTemplate({ enabled: true, urlTemplate: "  " })).toBeNull();
    expect(resolveGraylogTemplate(GRAYLOG_CONFIG)).toBe(GRAYLOG_CONFIG.urlTemplate);
  });

  it("treats a template without a literal {query} placeholder as disabled", () => {
    expect(
      resolveGraylogTemplate({ enabled: true, urlTemplate: "https://graylog.example.com/search" }),
    ).toBeNull();
    expect(
      resolveGraylogTemplate({
        enabled: true,
        urlTemplate: "https://graylog.example.com/search?q=%7Bquery%7D",
      }),
    ).toBeNull();
  });
});

describe("buildGraylogLinks (i15-1-blueapi)", () => {
  const links = buildGraylogLinks({
    urlTemplate: GRAYLOG_CONFIG.urlTemplate!,
    podField: "pod_name",
    nodes: I15_NODES,
  });

  it("adds one Graylog link per workload, sorted by name", () => {
    expect(links.workloads.map((g) => [g.name, g.detail])).toEqual([
      ["i15-1-blueapi", "StatefulSet"],
      ["i15-1-blueapi-oauth2", "Deployment"],
    ]);
    const [sts, deploy] = links.workloads.map((g) => g.links[0]);
    expect(sts).toMatchObject({ kind: "logs", label: "Graylog", range: "Last 2 hours" });
    expect(sts.url).toBe(
      `${GRAYLOG_SEARCH}?q=pod_name%3A%2Fi15-1-blueapi-%5B0-9%5D%2B%2F&rangetype=relative&from=7200`,
    );
    // The oauth2 pod belongs to the Deployment only.
    expect(toRegExp(sts.query!).test(I15_OAUTH_POD)).toBe(false);
    expect(toRegExp(deploy.query!).test(I15_OAUTH_POD)).toBe(true);
    expect(toRegExp(sts.query!).test("i15-1-blueapi-0")).toBe(true);
  });

  it("links only bare pods (no parentRefs) by name", () => {
    expect(links.pods).toEqual([]);
    const bare = buildGraylogLinks({
      urlTemplate: GRAYLOG_CONFIG.urlTemplate!,
      nodes: [...I15_NODES, { ...I15_NODES[4], name: "debug-shell", parentRefs: undefined }],
    });
    expect(bare.pods.map((g) => [g.name, g.links[0].query])).toEqual([
      ["debug-shell", 'pod_name:"debug-shell"'],
    ]);
  });

  it("defaults the pod field and omits the range when it can't be parsed", () => {
    const [g] = buildGraylogLinks({
      urlTemplate: "https://g.example.com/?q={query}",
      podField: " ",
      nodes: [I15_NODES[0]],
    }).workloads;
    expect(g.links[0].query).toBe("pod_name:/i15-1-blueapi-[0-9]+/");
    expect(g.links[0].range).toBeUndefined();
  });
});
