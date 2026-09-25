package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
)

func TestShareLifecycle(t *testing.T) {
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	// create a diagram
	_, body := rawReq(t, srv, http.MethodPost, "/api/diagrams", map[string]any{
		"name": "分享图",
		"data": map[string]any{"nodes": []any{map[string]any{"id": "n1"}}, "edges": []any{}},
	})
	var created map[string]any
	_ = json.Unmarshal(body, &created)
	id := created["id"].(string)

	// initially disabled
	res, body := rawReq(t, srv, http.MethodGet, "/api/diagrams/"+id+"/share", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get share = %d", res.StatusCode)
	}
	var share map[string]any
	_ = json.Unmarshal(body, &share)
	if share["enabled"] != false {
		t.Fatalf("expected disabled, got %v", share)
	}

	// enable
	res, body = rawReq(t, srv, http.MethodPost, "/api/diagrams/"+id+"/share", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("enable share = %d", res.StatusCode)
	}
	_ = json.Unmarshal(body, &share)
	token, _ := share["token"].(string)
	if token == "" {
		t.Fatalf("expected token, got %v", share)
	}

	// public fetch (no auth)
	res, body = rawReq(t, srv, http.MethodGet, "/api/share/"+token, nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("public share = %d (%s)", res.StatusCode, body)
	}
	var pub map[string]any
	_ = json.Unmarshal(body, &pub)
	if pub["name"] != "分享图" {
		t.Errorf("name = %v", pub["name"])
	}
	data := pub["data"].(map[string]any)
	if len(data["nodes"].([]any)) != 1 {
		t.Errorf("shared nodes = %v", data["nodes"])
	}

	// updates are reflected
	_, _ = rawReq(t, srv, http.MethodPut, "/api/diagrams/"+id, map[string]any{
		"name": "分享图v2",
		"data": map[string]any{"nodes": []any{map[string]any{"id": "n1"}, map[string]any{"id": "n2"}}, "edges": []any{}},
	})
	_, body = rawReq(t, srv, http.MethodGet, "/api/share/"+token, nil)
	_ = json.Unmarshal(body, &pub)
	data = pub["data"].(map[string]any)
	if len(data["nodes"].([]any)) != 2 {
		t.Errorf("after update shared nodes = %v", data["nodes"])
	}

	// disable -> public 404, token cleared
	res, _ = rawReq(t, srv, http.MethodDelete, "/api/diagrams/"+id+"/share", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("disable share = %d", res.StatusCode)
	}
	res, _ = rawReq(t, srv, http.MethodGet, "/api/share/"+token, nil)
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("public share after disable = %d, want 404", res.StatusCode)
	}
}

func TestShareUnknownToken(t *testing.T) {
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()
	res, _ := rawReq(t, srv, http.MethodGet, "/api/share/does-not-exist", nil)
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("unknown token = %d, want 404", res.StatusCode)
	}
}

func TestShareRotateToken(t *testing.T) {
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	_, body := rawReq(t, srv, http.MethodPost, "/api/diagrams", map[string]any{"name": "r"})
	var created map[string]any
	_ = json.Unmarshal(body, &created)
	id := created["id"].(string)

	_, body = rawReq(t, srv, http.MethodPost, "/api/diagrams/"+id+"/share", nil)
	var first map[string]any
	_ = json.Unmarshal(body, &first)
	t1 := first["token"].(string)

	// enabling again rotates the token
	_, body = rawReq(t, srv, http.MethodPost, "/api/diagrams/"+id+"/share", nil)
	var second map[string]any
	_ = json.Unmarshal(body, &second)
	t2 := second["token"].(string)

	if t1 == t2 {
		t.Errorf("expected token rotation, both %q", t1)
	}
	// old token no longer valid
	res, _ := rawReq(t, srv, http.MethodGet, "/api/share/"+t1, nil)
	if res.StatusCode != http.StatusNotFound {
		t.Errorf("old token = %d, want 404", res.StatusCode)
	}
	res, _ = rawReq(t, srv, http.MethodGet, "/api/share/"+t2, nil)
	if res.StatusCode != http.StatusOK {
		t.Errorf("new token = %d, want 200", res.StatusCode)
	}
}

func TestMigrationAddsShareColumn(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "legacy.db")

	// Simulate a database created before sharing existed.
	db, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatalf("open legacy: %v", err)
	}
	if _, err := db.Exec(`CREATE TABLE diagrams (
		id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
		data TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
	)`); err != nil {
		t.Fatalf("create legacy schema: %v", err)
	}
	_ = db.Close()

	// Opening it must migrate in the share_token column and index.
	s, err := NewStore(path)
	if err != nil {
		t.Fatalf("NewStore on legacy db: %v", err)
	}
	defer s.Close()

	d := sampleDiagram("legacy")
	if err := s.Create(d); err != nil {
		t.Fatalf("create on migrated db: %v", err)
	}
	token := newShareToken()
	if err := s.SetShareToken(d.ID, token); err != nil {
		t.Fatalf("set share token: %v", err)
	}
	got, err := s.GetShareToken(d.ID)
	if err != nil || got != token {
		t.Fatalf("GetShareToken = %q, %v; want %q", got, err, token)
	}
	if _, err := s.GetByShareToken(token); err != nil {
		t.Fatalf("GetByShareToken: %v", err)
	}
}

func TestShareAuthBoundary(t *testing.T) {
	t.Setenv("DIAGRAM_TOKEN", "s3cret")
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	// create with auth
	res, body := doJSON(t, srv, http.MethodPost, "/api/diagrams", "s3cret", map[string]any{"name": "auth"})
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create = %d", res.StatusCode)
	}
	id := body["id"].(string)

	// enabling share without token is forbidden
	res, _ = rawReq(t, srv, http.MethodPost, "/api/diagrams/"+id+"/share", nil)
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("enable without token = %d, want 401", res.StatusCode)
	}

	// enable with token
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/diagrams/"+id+"/share", nil)
	req.Header.Set("Authorization", "Bearer s3cret")
	r2, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("enable: %v", err)
	}
	var share map[string]any
	_ = json.NewDecoder(r2.Body).Decode(&share)
	r2.Body.Close()
	token, _ := share["token"].(string)
	if token == "" {
		t.Fatalf("no token: %v", share)
	}

	// public share endpoint needs no auth
	res, _ = rawReq(t, srv, http.MethodGet, "/api/share/"+token, nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("public share with auth enabled = %d", res.StatusCode)
	}
}
