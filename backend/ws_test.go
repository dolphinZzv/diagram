package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

func TestRealtimeSync(t *testing.T) {
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()
	wsBase := strings.Replace(srv.URL, "http", "ws", 1)

	// create a diagram and enable editable sharing
	_, body := rawReq(t, srv, http.MethodPost, "/api/diagrams", map[string]any{
		"name": "collab",
		"data": map[string]any{"nodes": []any{}, "edges": []any{}},
	})
	var created map[string]any
	_ = json.Unmarshal(body, &created)
	id := created["id"].(string)
	_, body = rawReq(t, srv, http.MethodPost, "/api/diagrams/"+id+"/edit", nil)
	var state map[string]any
	_ = json.Unmarshal(body, &state)
	token := state["token"].(string)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	dial := func() *websocket.Conn {
		c, _, err := websocket.Dial(ctx, wsBase+"/api/ws?token="+token, nil)
		if err != nil {
			t.Fatalf("dial: %v", err)
		}
		return c
	}
	read := func(c *websocket.Conn) wsOut {
		_, data, err := c.Read(ctx)
		if err != nil {
			t.Fatalf("read: %v", err)
		}
		var m wsOut
		if err := json.Unmarshal(data, &m); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		return m
	}

	c1 := dial()
	defer c1.Close(websocket.StatusNormalClosure, "")
	if m := read(c1); m.T != "init" {
		t.Fatalf("c1 first message = %s, want init", m.T)
	}

	c2 := dial()
	defer c2.Close(websocket.StatusNormalClosure, "")
	if m := read(c2); m.T != "init" {
		t.Fatalf("c2 first message = %s, want init", m.T)
	}
	// c1 sees c2 join
	if m := read(c1); m.T != "peer" || m.Event != "join" {
		t.Fatalf("c1 peer message = %+v", m)
	}

	// c1 sends a node op; c2 receives it
	node := json.RawMessage(`{"id":"n1","type":"shape","position":{"x":10,"y":20},"data":{"shape":"rect","label":"hi"},"style":{"width":120,"height":60}}`)
	opMsg, _ := json.Marshal(wsIn{T: "ops", Ops: []wsOp{{K: "node", ID: "n1", V: node}}})
	if err := c1.Write(ctx, websocket.MessageText, opMsg); err != nil {
		t.Fatalf("write: %v", err)
	}
	m := read(c2)
	if m.T != "ops" || len(m.Ops) != 1 || m.Ops[0].ID != "n1" {
		t.Fatalf("c2 got %+v", m)
	}

	// a third client joining gets the merged document
	time.Sleep(1200 * time.Millisecond) // let the debounced save run
	c3 := dial()
	defer c3.Close(websocket.StatusNormalClosure, "")
	init := read(c3)
	if init.Doc == nil || len(init.Doc.Nodes) != 1 {
		t.Fatalf("c3 init doc = %+v", init.Doc)
	}

	// persisted to the database
	_, body = rawReq(t, srv, http.MethodGet, "/api/edit/"+token, nil)
	var doc map[string]any
	_ = json.Unmarshal(body, &doc)
	if n := len(doc["data"].(map[string]any)["nodes"].([]any)); n != 1 {
		t.Fatalf("persisted nodes = %d, want 1", n)
	}
}
