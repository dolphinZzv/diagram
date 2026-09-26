package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Editable share grants read + write access to a single diagram via a token,
// without the global DIAGRAM_TOKEN.
func TestEditShareLifecycle(t *testing.T) {
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	// create a diagram
	_, body := rawReq(t, srv, http.MethodPost, "/api/diagrams", map[string]any{
		"name": "协作图",
		"data": map[string]any{"nodes": []any{}, "edges": []any{}},
	})
	var created map[string]any
	_ = json.Unmarshal(body, &created)
	id := created["id"].(string)

	// disabled initially
	_, body = rawReq(t, srv, http.MethodGet, "/api/diagrams/"+id+"/edit", nil)
	var state map[string]any
	_ = json.Unmarshal(body, &state)
	if state["enabled"] != false {
		t.Fatalf("expected disabled, got %v", state)
	}

	// enable -> token
	_, body = rawReq(t, srv, http.MethodPost, "/api/diagrams/"+id+"/edit", nil)
	_ = json.Unmarshal(body, &state)
	token, _ := state["token"].(string)
	if token == "" {
		t.Fatalf("expected token, got %v", state)
	}

	// public GET (no auth) returns the live draft
	res, body := rawReq(t, srv, http.MethodGet, "/api/edit/"+token, nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("public edit get = %d (%s)", res.StatusCode, body)
	}
	var got map[string]any
	_ = json.Unmarshal(body, &got)
	if got["name"] != "协作图" {
		t.Errorf("name = %v", got["name"])
	}
	if got["id"] != id {
		t.Errorf("id = %v want %s", got["id"], id)
	}

	// public PUT (no auth) saves the draft
	res, body = rawReq(t, srv, http.MethodPut, "/api/edit/"+token, map[string]any{
		"name": "协作图v2",
		"data": map[string]any{"nodes": []any{map[string]any{"id": "n1"}, map[string]any{"id": "n2"}}, "edges": []any{}},
	})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("public edit put = %d (%s)", res.StatusCode, body)
	}

	// persisted
	_, body = rawReq(t, srv, http.MethodGet, "/api/edit/"+token, nil)
	_ = json.Unmarshal(body, &got)
	if got["name"] != "协作图v2" {
		t.Errorf("after put name = %v", got["name"])
	}
	data := got["data"].(map[string]any)
	if len(data["nodes"].([]any)) != 2 {
		t.Errorf("after put nodes = %v", data["nodes"])
	}

	// the read-only share token must NOT grant write access
	_, shBody := rawReq(t, srv, http.MethodPost, "/api/diagrams/"+id+"/share", nil)
	var sh map[string]any
	_ = json.Unmarshal(shBody, &sh)
	readToken := sh["token"].(string)
	res, _ = rawReq(t, srv, http.MethodGet, "/api/edit/"+readToken, nil)
	if res.StatusCode != http.StatusNotFound {
		t.Errorf("read token used for edit = %d, want 404", res.StatusCode)
	}

	// disable -> public 404
	res, _ = rawReq(t, srv, http.MethodDelete, "/api/diagrams/"+id+"/edit", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("disable edit share = %d", res.StatusCode)
	}
	res, _ = rawReq(t, srv, http.MethodGet, "/api/edit/"+token, nil)
	if res.StatusCode != http.StatusNotFound {
		t.Errorf("after disable public edit = %d, want 404", res.StatusCode)
	}
}
