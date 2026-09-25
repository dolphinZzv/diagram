package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func decodeResp(t *testing.T, b []byte) map[string]any {
	t.Helper()
	if b == nil {
		t.Fatalf("nil response")
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatalf("decode response: %v (%s)", err, b)
	}
	return m
}

func TestMCPInitializeAndToolsList(t *testing.T) {
	s := &mcpServer{store: newTestStore(t)}

	// Notifications produce no response.
	if resp := s.handle([]byte(`{"jsonrpc":"2.0","method":"notifications/initialized"}`)); resp != nil {
		t.Fatalf("notification should not produce a response, got %s", resp)
	}

	m := decodeResp(t, s.handle([]byte(`{"jsonrpc":"2.0","id":1,"method":"initialize"}`)))
	result, _ := m["result"].(map[string]any)
	if result == nil || result["protocolVersion"] == nil {
		t.Fatalf("initialize result missing protocolVersion: %v", m)
	}
	if _, ok := result["serverInfo"]; !ok {
		t.Fatalf("initialize result missing serverInfo: %v", m)
	}

	m = decodeResp(t, s.handle([]byte(`{"jsonrpc":"2.0","id":2,"method":"tools/list"}`)))
	tools, _ := m["result"].(map[string]any)["tools"].([]any)
	if len(tools) < 15 {
		t.Fatalf("expected at least 15 tools, got %d", len(tools))
	}
	names := map[string]bool{}
	for _, tv := range tools {
		tm := tv.(map[string]any)
		names[tm["name"].(string)] = true
		if tm["inputSchema"] == nil {
			t.Errorf("tool %v missing inputSchema", tm["name"])
		}
	}
	for _, want := range []string{"diagram_create", "node_add", "edge_add", "diagram_get", "version_list", "share_enable"} {
		if !names[want] {
			t.Errorf("missing tool %s", want)
		}
	}
}

func TestMCPUnknown(t *testing.T) {
	s := &mcpServer{store: newTestStore(t)}
	m := decodeResp(t, s.handle([]byte(`{"jsonrpc":"2.0","id":1,"method":"does/not/exist"}`)))
	if m["error"] == nil {
		t.Fatalf("expected error for unknown method")
	}
	if resp := s.handle([]byte(`{not json`)); resp == nil {
		t.Fatalf("expected parse error response")
	}
}

// mcpCallRaw invokes a tool and returns the text content.
func mcpCallRaw(t *testing.T, s *mcpServer, name string, args map[string]any) (string, bool) {
	t.Helper()
	req := map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params":  map[string]any{"name": name, "arguments": args},
	}
	b, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	m := decodeResp(t, s.handle(b))
	result, _ := m["result"].(map[string]any)
	if result == nil {
		t.Fatalf("no result for %s: %v", name, m)
	}
	isError, _ := result["isError"].(bool)
	content, _ := result["content"].([]any)
	if len(content) == 0 {
		t.Fatalf("no content for %s", name)
	}
	text, _ := content[0].(map[string]any)["text"].(string)
	return text, isError
}

func mcpCall(t *testing.T, s *mcpServer, name string, args map[string]any) map[string]any {
	t.Helper()
	text, isErr := mcpCallRaw(t, s, name, args)
	if isErr {
		t.Fatalf("tool %s returned error: %s", name, text)
	}
	var out map[string]any
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		t.Fatalf("tool %s returned non-object: %s", name, text)
	}
	return out
}

func TestMCPToolFlow(t *testing.T) {
	s := &mcpServer{store: newTestStore(t)}

	created := mcpCall(t, s, "diagram_create", map[string]any{"name": "MCP flow"})
	id, _ := created["id"].(string)
	if id == "" {
		t.Fatalf("no id from diagram_create: %v", created)
	}

	a := mcpCall(t, s, "node_add", map[string]any{"id": id, "shape": "rounded", "label": "A", "x": 0, "y": 0})
	b := mcpCall(t, s, "node_add", map[string]any{"id": id, "shape": "rect", "label": "B", "x": 200, "y": 0})
	aID, _ := a["nodeId"].(string)
	bID, _ := b["nodeId"].(string)
	if aID == "" || bID == "" {
		t.Fatalf("node_add did not return ids: %v %v", a, b)
	}
	// defaults were applied
	if a["width"].(float64) <= 0 || a["height"].(float64) <= 0 {
		t.Errorf("node_add did not apply default size: %v", a)
	}

	edge := mcpCall(t, s, "edge_add", map[string]any{"id": id, "source": aID, "target": bID, "label": "next"})
	edgeID, _ := edge["edgeId"].(string)

	doc := mcpCall(t, s, "diagram_get", map[string]any{"id": id})
	data, _ := doc["data"].(map[string]any)
	if len(data["nodes"].([]any)) != 2 {
		t.Fatalf("expected 2 nodes, got %v", data["nodes"])
	}
	if len(data["edges"].([]any)) != 1 {
		t.Fatalf("expected 1 edge, got %v", data["edges"])
	}

	// update a node
	mcpCall(t, s, "node_update", map[string]any{
		"id": id, "nodeId": aID, "patch": map[string]any{"fill": "#ff0000", "label": "A2"},
	})
	doc = mcpCall(t, s, "diagram_get", map[string]any{"id": id})
	data, _ = doc["data"].(map[string]any)
	node0 := data["nodes"].([]any)[0].(map[string]any)
	if node0["data"].(map[string]any)["fill"] != "#ff0000" {
		t.Errorf("node_update did not apply fill: %v", node0)
	}

	// remove edge
	mcpCall(t, s, "edge_remove", map[string]any{"id": id, "edgeIds": []any{edgeID}})
	doc = mcpCall(t, s, "diagram_get", map[string]any{"id": id})
	data, _ = doc["data"].(map[string]any)
	if len(data["edges"].([]any)) != 0 {
		t.Errorf("edge_remove failed: %v", data["edges"])
	}

	// remove node also drops connected edges
	mcpCall(t, s, "edge_add", map[string]any{"id": id, "source": aID, "target": bID})
	mcpCall(t, s, "node_remove", map[string]any{"id": id, "nodeIds": []any{aID}})
	doc = mcpCall(t, s, "diagram_get", map[string]any{"id": id})
	data, _ = doc["data"].(map[string]any)
	if len(data["nodes"].([]any)) != 1 || len(data["edges"].([]any)) != 0 {
		t.Errorf("node_remove should drop node and its edges, got %v / %v", data["nodes"], data["edges"])
	}

	// version + share
	mcpCall(t, s, "version_create", map[string]any{"id": id, "label": "checkpoint"})
	text, isErr := mcpCallRaw(t, s, "version_list", map[string]any{"id": id})
	if isErr {
		t.Fatalf("version_list error: %s", text)
	}
	var versions []map[string]any
	if err := json.Unmarshal([]byte(text), &versions); err != nil {
		t.Fatalf("version_list not an array: %s", text)
	}
	if len(versions) < 2 {
		t.Errorf("expected versions (create + manual), got %d", len(versions))
	}

	share := mcpCall(t, s, "share_enable", map[string]any{"id": id})
	if share["token"] == "" {
		t.Errorf("share_enable did not return a token: %v", share)
	}
	got := mcpCall(t, s, "share_get", map[string]any{"id": id})
	if got["enabled"] != true {
		t.Errorf("share_get should report enabled: %v", got)
	}
	mcpCall(t, s, "share_disable", map[string]any{"id": id})
	got = mcpCall(t, s, "share_get", map[string]any{"id": id})
	if got["enabled"] != false {
		t.Errorf("share should be disabled: %v", got)
	}
}

func TestMCPToolErrors(t *testing.T) {
	s := &mcpServer{store: newTestStore(t)}

	// missing required argument
	if _, isErr := mcpCallRaw(t, s, "diagram_get", map[string]any{}); !isErr {
		t.Errorf("expected error when id is missing")
	}
	// unknown tool
	if _, isErr := mcpCallRaw(t, s, "nope", map[string]any{}); !isErr {
		t.Errorf("expected error for unknown tool")
	}
	// edge with missing nodes
	created := mcpCall(t, s, "diagram_create", map[string]any{"name": "x"})
	id := created["id"].(string)
	if _, isErr := mcpCallRaw(t, s, "edge_add", map[string]any{"id": id, "source": "nope", "target": "nope2"}); !isErr {
		t.Errorf("expected error for edge_add with unknown nodes")
	}
}

func TestMCPHTTPTransport(t *testing.T) {
	hs := httptest.NewServer(mcpHTTPHandler(&mcpServer{store: newTestStore(t)}))
	defer hs.Close()

	post := func(body, accept string) *http.Response {
		req, _ := http.NewRequest(http.MethodPost, hs.URL, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if accept != "" {
			req.Header.Set("Accept", accept)
		}
		res, err := hs.Client().Do(req)
		if err != nil {
			t.Fatalf("post: %v", err)
		}
		return res
	}

	// initialize over JSON
	res := post(`{"jsonrpc":"2.0","id":1,"method":"initialize"}`, "application/json")
	if res.StatusCode != http.StatusOK {
		t.Fatalf("initialize status = %d", res.StatusCode)
	}
	if res.Header.Get("Mcp-Session-Id") == "" {
		t.Errorf("missing Mcp-Session-Id header")
	}
	var m map[string]any
	_ = json.NewDecoder(res.Body).Decode(&m)
	res.Body.Close()
	if m["result"].(map[string]any)["serverInfo"] == nil {
		t.Errorf("initialize result missing serverInfo: %v", m)
	}

	// tools/list over JSON
	res = post(`{"jsonrpc":"2.0","id":2,"method":"tools/list"}`, "application/json")
	_ = json.NewDecoder(res.Body).Decode(&m)
	res.Body.Close()
	if len(m["result"].(map[string]any)["tools"].([]any)) < 15 {
		t.Errorf("tools/list returned too few tools")
	}

	// notification -> 202 with empty body
	res = post(`{"jsonrpc":"2.0","method":"notifications/initialized"}`, "application/json")
	if res.StatusCode != http.StatusAccepted {
		t.Errorf("notification status = %d, want 202", res.StatusCode)
	}
	res.Body.Close()

	// SSE response
	res = post(`{"jsonrpc":"2.0","id":3,"method":"ping"}`, "text/event-stream")
	if ct := res.Header.Get("Content-Type"); !strings.Contains(ct, "text/event-stream") {
		t.Errorf("SSE content-type = %q", ct)
	}
	body, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if !strings.Contains(string(body), "event: message") || !strings.Contains(string(body), `"id":3`) {
		t.Errorf("unexpected SSE body: %s", body)
	}

	// GET not allowed
	req, _ := http.NewRequest(http.MethodGet, hs.URL, nil)
	res, _ = hs.Client().Do(req)
	res.Body.Close()
	if res.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("GET status = %d, want 405", res.StatusCode)
	}

	// DELETE ends session
	req, _ = http.NewRequest(http.MethodDelete, hs.URL, nil)
	res, _ = hs.Client().Do(req)
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Errorf("DELETE status = %d, want 200", res.StatusCode)
	}
}

func TestMCPHTTPAuth(t *testing.T) {
	t.Setenv("DIAGRAM_TOKEN", "s3cret")
	hs := httptest.NewServer(newRouter(newTestStore(t)))
	defer hs.Close()

	newReq := func(token string) *http.Request {
		req, _ := http.NewRequest(http.MethodPost, hs.URL+"/mcp", strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"initialize"}`))
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		return req
	}

	res, err := hs.Client().Do(newReq(""))
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("no-token status = %d, want 401", res.StatusCode)
	}

	res, err = hs.Client().Do(newReq("s3cret"))
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("with-token status = %d, want 200", res.StatusCode)
	}
}
