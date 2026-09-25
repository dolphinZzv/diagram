package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestComponentCRUD(t *testing.T) {
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	// create
	res, body := rawReq(t, srv, http.MethodPost, "/api/components", map[string]any{
		"id":       "c_1",
		"name":     "网关",
		"category": "网络",
		"kind":     "single",
		"data": map[string]any{
			"nodes": []any{map[string]any{"id": "n1"}},
			"edges": []any{},
		},
	})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("create = %d (%s)", res.StatusCode, body)
	}

	// list
	_, body = rawReq(t, srv, http.MethodGet, "/api/components", nil)
	var list []map[string]any
	_ = json.Unmarshal(body, &list)
	if len(list) != 1 || list[0]["name"] != "网关" {
		t.Fatalf("list = %v", list)
	}

	// update (upsert by id)
	res, _ = rawReq(t, srv, http.MethodPut, "/api/components/c_1", map[string]any{
		"name":     "网关 v2",
		"category": "网络",
		"data":     map[string]any{"nodes": []any{}, "edges": []any{}},
	})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("update = %d", res.StatusCode)
	}
	_, body = rawReq(t, srv, http.MethodGet, "/api/components", nil)
	_ = json.Unmarshal(body, &list)
	if list[0]["name"] != "网关 v2" {
		t.Fatalf("after update = %v", list[0])
	}

	// delete
	res, _ = rawReq(t, srv, http.MethodDelete, "/api/components/c_1", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("delete = %d", res.StatusCode)
	}
	_, body = rawReq(t, srv, http.MethodGet, "/api/components", nil)
	_ = json.Unmarshal(body, &list)
	if len(list) != 0 {
		t.Fatalf("after delete = %v", list)
	}
}

func TestComponentAuth(t *testing.T) {
	t.Setenv("DIAGRAM_TOKEN", "s3cret")
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	res, _ := rawReq(t, srv, http.MethodGet, "/api/components", nil)
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("no-token = %d, want 401", res.StatusCode)
	}
}

func TestComponentMCPFlow(t *testing.T) {
	s := &mcpServer{store: newTestStore(t)}

	// Create a component from nodes/edges.
	created := mcpCall(t, s, "component_create", map[string]any{
		"name":     "用户中心",
		"category": "业务",
		"nodes": []any{
			map[string]any{"id": "a", "type": "shape", "position": map[string]any{"x": 0, "y": 0}, "data": map[string]any{"label": "A"}},
			map[string]any{"id": "b", "type": "shape", "position": map[string]any{"x": 200, "y": 0}, "data": map[string]any{"label": "B"}},
		},
		"edges": []any{map[string]any{"id": "e", "source": "a", "target": "b", "type": "custom", "data": map[string]any{}}},
	})
	componentID, _ := created["id"].(string)
	if componentID == "" {
		t.Fatalf("no component id: %v", created)
	}
	if created["kind"] != "compound" {
		t.Errorf("kind = %v, want compound", created["kind"])
	}

	// List includes it (metadata only).
	text, _ := mcpCallRaw(t, s, "component_list", map[string]any{})
	var list []map[string]any
	if err := json.Unmarshal([]byte(text), &list); err != nil {
		t.Fatalf("component_list not an array: %s", text)
	}
	if len(list) != 1 || list[0]["name"] != "用户中心" {
		t.Fatalf("list = %v", list)
	}

	// Create a diagram and apply the component.
	dg := mcpCall(t, s, "diagram_create", map[string]any{"name": "apply test"})
	diagramID := dg["id"].(string)

	mcpCall(t, s, "component_apply", map[string]any{
		"diagramId": diagramID, "componentId": componentID, "x": 100, "y": 50,
	})
	doc := mcpCall(t, s, "diagram_get", map[string]any{"id": diagramID})
	data := doc["data"].(map[string]any)
	if len(data["nodes"].([]any)) != 2 || len(data["edges"].([]any)) != 1 {
		t.Fatalf("after apply: %d nodes / %d edges", len(data["nodes"].([]any)), len(data["edges"].([]any)))
	}
	first := data["nodes"].([]any)[0].(map[string]any)
	pos := first["position"].(map[string]any)
	if pos["x"].(float64) != 100 || pos["y"].(float64) != 50 {
		t.Errorf("applied position = %v, want 100/50", pos)
	}
	// Edge endpoints remapped to the cloned node ids.
	edge := data["edges"].([]any)[0].(map[string]any)
	ids := map[string]bool{}
	for _, nv := range data["nodes"].([]any) {
		ids[nv.(map[string]any)["id"].(string)] = true
	}
	if !ids[edge["source"].(string)] || !ids[edge["target"].(string)] {
		t.Errorf("edge not remapped: %v", edge)
	}

	// Delete component.
	mcpCall(t, s, "component_delete", map[string]any{"id": componentID})
	text, _ = mcpCallRaw(t, s, "component_list", map[string]any{})
	_ = json.Unmarshal([]byte(text), &list)
	if len(list) != 0 {
		t.Errorf("component not deleted: %v", list)
	}
}
