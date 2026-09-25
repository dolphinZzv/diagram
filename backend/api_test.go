package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func doJSON(t *testing.T, srv *httptest.Server, method, path, token string, body any) (*http.Response, map[string]any) {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(b)
	} else {
		reader = bytes.NewReader(nil)
	}
	req, err := http.NewRequest(method, srv.URL+path, reader)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	var decoded map[string]any
	_ = json.NewDecoder(res.Body).Decode(&decoded)
	res.Body.Close()
	return res, decoded
}

func TestAPICRUDFlow(t *testing.T) {
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	// create
	res, created := doJSON(t, srv, http.MethodPost, "/api/diagrams", "", map[string]any{
		"name": "架构图",
		"data": map[string]any{"nodes": []any{}, "edges": []any{}},
	})
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create status = %d, want 201", res.StatusCode)
	}
	id, _ := created["id"].(string)
	if id == "" {
		t.Fatalf("create response missing id: %v", created)
	}
	if created["name"] != "架构图" {
		t.Errorf("create name = %v, want 架构图", created["name"])
	}

	// get
	res, got := doJSON(t, srv, http.MethodGet, "/api/diagrams/"+id, "", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get status = %d, want 200", res.StatusCode)
	}
	if got["id"] != id {
		t.Errorf("get id = %v, want %s", got["id"], id)
	}

	// update
	res, updated := doJSON(t, srv, http.MethodPut, "/api/diagrams/"+id, "", map[string]any{
		"name": "架构图 v2",
		"data": map[string]any{"nodes": []any{map[string]any{"id": "n1"}}, "edges": []any{}},
	})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("update status = %d, want 200", res.StatusCode)
	}
	if updated["name"] != "架构图 v2" {
		t.Errorf("update name = %v, want 架构图 v2", updated["name"])
	}

	// list
	res, _ = doJSON(t, srv, http.MethodGet, "/api/diagrams", "", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("list status = %d, want 200", res.StatusCode)
	}

	// delete
	res, _ = doJSON(t, srv, http.MethodDelete, "/api/diagrams/"+id, "", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("delete status = %d, want 200", res.StatusCode)
	}

	// get after delete -> 404
	res, _ = doJSON(t, srv, http.MethodGet, "/api/diagrams/"+id, "", nil)
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("get-after-delete status = %d, want 404", res.StatusCode)
	}
}

func TestAPICreateDefaults(t *testing.T) {
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	res, created := doJSON(t, srv, http.MethodPost, "/api/diagrams", "", map[string]any{})
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("status = %d, want 201", res.StatusCode)
	}
	if created["name"] == "" || created["name"] == nil {
		t.Errorf("expected a default name, got %v", created["name"])
	}
	data, _ := created["data"].(map[string]any)
	if data == nil {
		t.Fatalf("expected default data, got %v", created["data"])
	}
}

func TestAPIPublicEndpoints(t *testing.T) {
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	for _, path := range []string{"/api/health", "/api/version"} {
		res, _ := doJSON(t, srv, http.MethodGet, path, "", nil)
		if res.StatusCode != http.StatusOK {
			t.Errorf("GET %s = %d, want 200", path, res.StatusCode)
		}
	}
}

func TestAPIAuth(t *testing.T) {
	t.Setenv("DIAGRAM_TOKEN", "s3cret")
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	// Without token -> 401
	res, _ := doJSON(t, srv, http.MethodGet, "/api/diagrams", "", nil)
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("no-token status = %d, want 401", res.StatusCode)
	}

	// Wrong token -> 401
	res, _ = doJSON(t, srv, http.MethodGet, "/api/diagrams", "wrong", nil)
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("wrong-token status = %d, want 401", res.StatusCode)
	}

	// Correct token -> 200
	res, _ = doJSON(t, srv, http.MethodGet, "/api/diagrams", "s3cret", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("valid-token status = %d, want 200", res.StatusCode)
	}

	// Health stays public even with auth enabled.
	res, _ = doJSON(t, srv, http.MethodGet, "/api/health", "", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("health with auth status = %d, want 200", res.StatusCode)
	}

	// Query-param token works too.
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/diagrams?token=s3cret", nil)
	res2, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("query token request: %v", err)
	}
	res2.Body.Close()
	if res2.StatusCode != http.StatusOK {
		t.Fatalf("query-token status = %d, want 200", res2.StatusCode)
	}
}

func TestAPIBadJSON(t *testing.T) {
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/diagrams", strings.NewReader("{not json"))
	req.Header.Set("Content-Type", "application/json")
	res, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("bad json status = %d, want 400", res.StatusCode)
	}
}
