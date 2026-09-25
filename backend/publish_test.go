package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPublishLifecycle(t *testing.T) {
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	// Create a diagram with one node.
	_, body := rawReq(t, srv, http.MethodPost, "/api/diagrams", map[string]any{
		"name": "pub",
		"data": map[string]any{"nodes": []any{map[string]any{"id": "n1"}}, "edges": []any{}},
	})
	var created map[string]any
	_ = json.Unmarshal(body, &created)
	id := created["id"].(string)

	// Enable sharing.
	_, body = rawReq(t, srv, http.MethodPost, "/api/diagrams/"+id+"/share", nil)
	var share map[string]any
	_ = json.Unmarshal(body, &share)
	token := share["token"].(string)

	// Not published yet.
	var state map[string]any
	_, body = rawReq(t, srv, http.MethodGet, "/api/diagrams/"+id+"/publish", nil)
	_ = json.Unmarshal(body, &state)
	if state["published"] != false {
		t.Fatalf("expected not published, got %v", state)
	}

	// Publish.
	res, _ := rawReq(t, srv, http.MethodPost, "/api/diagrams/"+id+"/publish", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("publish = %d", res.StatusCode)
	}
	_, body = rawReq(t, srv, http.MethodGet, "/api/diagrams/"+id+"/publish", nil)
	_ = json.Unmarshal(body, &state)
	if state["published"] != true || state["dirty"] != false {
		t.Fatalf("expected published && !dirty, got %v", state)
	}

	// Public share serves the published snapshot.
	var pub map[string]any
	_, body = rawReq(t, srv, http.MethodGet, "/api/share/"+token, nil)
	_ = json.Unmarshal(body, &pub)
	if n := len(pub["data"].(map[string]any)["nodes"].([]any)); n != 1 {
		t.Fatalf("share nodes = %d, want 1", n)
	}

	// Edit the draft (2 nodes).
	_, _ = rawReq(t, srv, http.MethodPut, "/api/diagrams/"+id, map[string]any{
		"name": "pub",
		"data": map[string]any{
			"nodes": []any{map[string]any{"id": "n1"}, map[string]any{"id": "n2"}},
			"edges": []any{},
		},
	})
	_, body = rawReq(t, srv, http.MethodGet, "/api/diagrams/"+id+"/publish", nil)
	_ = json.Unmarshal(body, &state)
	if state["dirty"] != true {
		t.Fatalf("expected dirty after edit, got %v", state)
	}

	// The share still shows the published version, not the draft.
	_, body = rawReq(t, srv, http.MethodGet, "/api/share/"+token, nil)
	_ = json.Unmarshal(body, &pub)
	if n := len(pub["data"].(map[string]any)["nodes"].([]any)); n != 1 {
		t.Fatalf("share should show published (1 node), got %d", n)
	}

	// Publish again -> share reflects the new version.
	_, _ = rawReq(t, srv, http.MethodPost, "/api/diagrams/"+id+"/publish", nil)
	_, body = rawReq(t, srv, http.MethodGet, "/api/share/"+token, nil)
	_ = json.Unmarshal(body, &pub)
	if n := len(pub["data"].(map[string]any)["nodes"].([]any)); n != 2 {
		t.Fatalf("share should show latest published (2 nodes), got %d", n)
	}

	// Unpublish -> falls back to the current data.
	res, _ = rawReq(t, srv, http.MethodDelete, "/api/diagrams/"+id+"/publish", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("unpublish = %d", res.StatusCode)
	}
	_, body = rawReq(t, srv, http.MethodGet, "/api/diagrams/"+id+"/publish", nil)
	_ = json.Unmarshal(body, &state)
	if state["published"] != false {
		t.Fatalf("expected not published after unpublish, got %v", state)
	}
}

func TestPublishUnknownDiagram(t *testing.T) {
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	res, _ := rawReq(t, srv, http.MethodPost, "/api/diagrams/nope/publish", nil)
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("publish unknown = %d, want 404", res.StatusCode)
	}
	res, _ = rawReq(t, srv, http.MethodGet, "/api/diagrams/nope/publish", nil)
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("get unknown publish = %d, want 404", res.StatusCode)
	}
}
