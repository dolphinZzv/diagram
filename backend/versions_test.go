package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func rawReq(t *testing.T, srv *httptest.Server, method, path string, body any) (*http.Response, []byte) {
	t.Helper()
	var r io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		r = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, srv.URL+path, r)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(res.Body)
	return res, data
}

func decodeList(t *testing.T, data []byte) []map[string]any {
	t.Helper()
	var out []map[string]any
	if err := json.Unmarshal(data, &out); err != nil {
		t.Fatalf("decode list: %v (%s)", err, data)
	}
	return out
}

func TestVersionLifecycle(t *testing.T) {
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	// create -> initial revision
	res, body := rawReq(t, srv, http.MethodPost, "/api/diagrams", map[string]any{
		"name": "版本图",
		"data": map[string]any{"nodes": []any{map[string]any{"id": "n1"}}, "edges": []any{}},
	})
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create = %d", res.StatusCode)
	}
	var created map[string]any
	_ = json.Unmarshal(body, &created)
	id, _ := created["id"].(string)
	if id == "" {
		t.Fatal("missing id")
	}

	// list -> one version, origin create
	res, body = rawReq(t, srv, http.MethodGet, "/api/diagrams/"+id+"/versions", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("list versions = %d", res.StatusCode)
	}
	versions := decodeList(t, body)
	if len(versions) != 1 {
		t.Fatalf("want 1 version, got %d", len(versions))
	}
	if versions[0]["origin"] != "create" {
		t.Errorf("origin = %v, want create", versions[0]["origin"])
	}

	// update with changed data -> auto revision
	res, _ = rawReq(t, srv, http.MethodPut, "/api/diagrams/"+id, map[string]any{
		"name": "版本图",
		"data": map[string]any{"nodes": []any{map[string]any{"id": "n1"}, map[string]any{"id": "n2"}}, "edges": []any{}},
	})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("update = %d", res.StatusCode)
	}
	_, body = rawReq(t, srv, http.MethodGet, "/api/diagrams/"+id+"/versions", nil)
	versions = decodeList(t, body)
	if len(versions) != 2 {
		t.Fatalf("want 2 versions, got %d", len(versions))
	}
	if versions[0]["origin"] != "auto" {
		t.Errorf("newest origin = %v, want auto", versions[0]["origin"])
	}
	if n, _ := versions[0]["nodeCount"].(float64); n != 2 {
		t.Errorf("nodeCount = %v, want 2", versions[0]["nodeCount"])
	}

	// update with identical data -> no new revision
	res, _ = rawReq(t, srv, http.MethodPut, "/api/diagrams/"+id, map[string]any{
		"name": "改名不改图",
		"data": map[string]any{"nodes": []any{map[string]any{"id": "n1"}, map[string]any{"id": "n2"}}, "edges": []any{}},
	})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("second update = %d", res.StatusCode)
	}
	_, body = rawReq(t, srv, http.MethodGet, "/api/diagrams/"+id+"/versions", nil)
	if got := len(decodeList(t, body)); got != 2 {
		t.Fatalf("unchanged data should not create a version, got %d", got)
	}

	// fetch version 1 payload
	res, body = rawReq(t, srv, http.MethodGet, "/api/diagrams/"+id+"/versions/1", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get version = %d", res.StatusCode)
	}
	var v1 map[string]any
	_ = json.Unmarshal(body, &v1)
	if v1["version"].(float64) != 1 {
		t.Fatalf("version = %v", v1["version"])
	}

	// restore version 1
	res, body = rawReq(t, srv, http.MethodPost, "/api/diagrams/"+id+"/versions/1/restore", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("restore = %d (%s)", res.StatusCode, body)
	}

	// diagram now has 1 node again
	_, body = rawReq(t, srv, http.MethodGet, "/api/diagrams/"+id, nil)
	var d map[string]any
	_ = json.Unmarshal(body, &d)
	data := d["data"].(map[string]any)
	if len(data["nodes"].([]any)) != 1 {
		t.Fatalf("after restore nodes = %d, want 1", len(data["nodes"].([]any)))
	}

	// a restore revision was appended
	_, body = rawReq(t, srv, http.MethodGet, "/api/diagrams/"+id+"/versions", nil)
	versions = decodeList(t, body)
	if len(versions) != 3 {
		t.Fatalf("want 3 versions after restore, got %d", len(versions))
	}
	if versions[0]["origin"] != "restore" {
		t.Errorf("newest origin = %v, want restore", versions[0]["origin"])
	}

	// manual snapshot
	res, _ = rawReq(t, srv, http.MethodPost, "/api/diagrams/"+id+"/versions", map[string]any{"label": "里程碑"})
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("manual snapshot = %d", res.StatusCode)
	}

	// delete a version
	res, _ = rawReq(t, srv, http.MethodDelete, "/api/diagrams/"+id+"/versions/1", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("delete version = %d", res.StatusCode)
	}
	res, _ = rawReq(t, srv, http.MethodGet, "/api/diagrams/"+id+"/versions/1", nil)
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("get deleted version = %d, want 404", res.StatusCode)
	}
}

func TestVersionsRemovedWithDiagram(t *testing.T) {
	store := newTestStore(t)
	srv := httptest.NewServer(newRouter(store))
	defer srv.Close()

	_, body := rawReq(t, srv, http.MethodPost, "/api/diagrams", map[string]any{"name": "x"})
	var created map[string]any
	_ = json.Unmarshal(body, &created)
	id := created["id"].(string)

	if vs, _ := store.ListVersions(id); len(vs) == 0 {
		t.Fatal("expected an initial version")
	}
	res, _ := rawReq(t, srv, http.MethodDelete, "/api/diagrams/"+id, nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("delete diagram = %d", res.StatusCode)
	}
	if vs, _ := store.ListVersions(id); len(vs) != 0 {
		t.Fatalf("versions should be deleted with the diagram, got %d", len(vs))
	}
}

func TestVersionPrune(t *testing.T) {
	s := newTestStore(t)
	d := sampleDiagram("prune")
	if err := s.Create(d); err != nil {
		t.Fatalf("create: %v", err)
	}
	for i := 0; i < 5; i++ {
		if _, err := s.CreateVersion(DiagramVersion{
			DiagramID: d.ID,
			Data:      json.RawMessage(fmt.Sprintf(`{"nodes":[],"edges":[],"i":%d}`, i)),
		}); err != nil {
			t.Fatalf("create version %d: %v", i, err)
		}
	}
	if vs, _ := s.ListVersions(d.ID); len(vs) != 5 {
		t.Fatalf("want 5 versions, got %d", len(vs))
	}
	if err := s.PruneVersions(d.ID, 3); err != nil {
		t.Fatalf("prune: %v", err)
	}
	vs, _ := s.ListVersions(d.ID)
	if len(vs) != 3 {
		t.Fatalf("after prune want 3, got %d", len(vs))
	}
	if vs[0].Version != 5 || vs[2].Version != 3 {
		t.Fatalf("kept wrong versions: %d..%d", vs[0].Version, vs[2].Version)
	}
}

func TestShouldVersion(t *testing.T) {
	s := newTestStore(t)
	d := sampleDiagram("sv")
	if err := s.Create(d); err != nil {
		t.Fatalf("create: %v", err)
	}
	if !s.ShouldVersion(d.ID, d.Data) {
		t.Errorf("first data should need a version")
	}
	if _, err := s.CreateVersion(DiagramVersion{DiagramID: d.ID, Data: d.Data}); err != nil {
		t.Fatalf("create version: %v", err)
	}
	if s.ShouldVersion(d.ID, d.Data) {
		t.Errorf("identical data should not need a version")
	}
	if !s.ShouldVersion(d.ID, json.RawMessage(`{"nodes":[{"id":"z"}],"edges":[]}`)) {
		t.Errorf("changed data should need a version")
	}
}
