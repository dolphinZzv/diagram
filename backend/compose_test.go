package main

import (
	"encoding/json"
	"testing"
)

func TestLayoutLayeredTB(t *testing.T) {
	nodes := []layoutNode{{ID: "a", W: 120, H: 60}, {ID: "b", W: 120, H: 60}, {ID: "c", W: 120, H: 60}}
	edges := []layoutEdge{{Source: "a", Target: "b"}, {Source: "a", Target: "c"}}
	pos := layoutLayered(nodes, edges, "TB")

	if pos["b"][1] <= pos["a"][1] {
		t.Errorf("b should be below a: a=%v b=%v", pos["a"], pos["b"])
	}
	if pos["c"][1] != pos["b"][1] {
		t.Errorf("b and c should share a layer: %v %v", pos["b"], pos["c"])
	}
	if pos["b"][0] == pos["c"][0] {
		t.Errorf("b and c should be spread on x: %v %v", pos["b"], pos["c"])
	}
}

func TestLayoutLayeredLR(t *testing.T) {
	nodes := []layoutNode{{ID: "a", W: 120, H: 60}, {ID: "b", W: 120, H: 60}}
	pos := layoutLayered(nodes, []layoutEdge{{Source: "a", Target: "b"}}, "LR")
	if pos["b"][0] <= pos["a"][0] {
		t.Errorf("b should be to the right of a: a=%v b=%v", pos["a"], pos["b"])
	}
}

func TestMCPCompose(t *testing.T) {
	s := &mcpServer{store: newTestStore(t)}

	out, err := s.callTool("diagram_compose", map[string]any{
		"name":      "组合图",
		"direction": "LR",
		"nodes": []any{
			map[string]any{"id": "a", "label": "入口", "shape": "rounded"},
			map[string]any{"id": "b", "label": "出口"},
			map[string]any{"id": "c", "label": "判断", "shape": "diamond"},
		},
		"edges": []any{
			map[string]any{"from": "a", "to": "c"},
			map[string]any{"from": "c", "to": "b", "lineStyle": "dashed", "label": "yes"},
		},
	})
	if err != nil {
		t.Fatalf("compose: %v", err)
	}
	var res map[string]any
	if err := json.Unmarshal([]byte(out), &res); err != nil {
		t.Fatalf("decode: %v (%s)", err, out)
	}
	id, _ := res["id"].(string)
	if id == "" {
		t.Fatalf("compose returned no id: %s", out)
	}

	d, err := s.store.Get(id)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	var doc DiagramDoc
	if err := json.Unmarshal(d.Data, &doc); err != nil {
		t.Fatalf("unmarshal doc: %v", err)
	}
	if len(doc.Nodes) != 3 || len(doc.Edges) != 2 {
		t.Fatalf("nodes=%d edges=%d, want 3/2", len(doc.Nodes), len(doc.Edges))
	}

	// LR layout: source handle r, target handle l, and x increases with depth.
	x := map[string]float64{}
	for _, n := range doc.Nodes {
		pos, _ := n["position"].(map[string]any)
		xf, _ := pos["x"].(float64)
		x[asString(n["data"].(map[string]any)["label"])] = xf
	}
	for _, e := range doc.Edges {
		if asString(e["sourceHandle"]) != "r" || asString(e["targetHandle"]) != "l" {
			t.Errorf("LR edge handles = %v/%v, want r/l", e["sourceHandle"], e["targetHandle"])
		}
	}
	if !(x["入口"] < x["判断"] && x["判断"] < x["出口"]) {
		t.Errorf("left-to-right order wrong: %v", x)
	}
}

func TestMCPComposeRejectsUnknownEdge(t *testing.T) {
	s := &mcpServer{store: newTestStore(t)}
	_, err := s.callTool("diagram_compose", map[string]any{
		"name":  "bad",
		"nodes": []any{map[string]any{"id": "a", "label": "A"}},
		"edges": []any{map[string]any{"from": "a", "to": "missing"}},
	})
	if err == nil {
		t.Fatal("expected error for edge referencing an unknown node")
	}
}

func TestMCPComposeToolListed(t *testing.T) {
	s := &mcpServer{store: newTestStore(t)}
	found := false
	for _, def := range s.toolDefs() {
		if def["name"] == "diagram_compose" {
			found = true
		}
	}
	if !found {
		t.Fatal("diagram_compose not present in tools/list")
	}
}
