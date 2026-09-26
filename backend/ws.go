package main

import (
	"context"
	"encoding/json"
	"errors"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
)

// ----------------------------------------------------------------------------
// Realtime collaboration rooms.
//
// Each diagram has one room keyed by its id. Clients join with an editable-share
// token over /api/ws?token=<editToken>. The server totally orders incoming
// operations (one room mutex), applies them to the authoritative document and
// broadcasts them to the other clients. Conflicts are resolved last-write-wins.
// The merged document is persisted to SQLite (debounced).
// ----------------------------------------------------------------------------

type wsOp struct {
	K    string          `json:"k"` // node | edge | meta
	ID   string          `json:"id,omitempty"`
	V    json.RawMessage `json:"v,omitempty"` // null/absent => delete
	Name string          `json:"name,omitempty"`
}

type wsCursor struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type wsPeer struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type wsDoc struct {
	Name  string            `json:"name"`
	Nodes []json.RawMessage `json:"nodes"`
	Edges []json.RawMessage `json:"edges"`
}

// inbound client message
type wsIn struct {
	T         string    `json:"t"` // hello | ops | presence
	Ops       []wsOp    `json:"ops,omitempty"`
	Cursor    *wsCursor `json:"cursor,omitempty"`
	Selection []string  `json:"selection,omitempty"`
	Name      string    `json:"name,omitempty"`
}

// outbound server message
type wsOut struct {
	T         string          `json:"t"`
	From      string          `json:"from,omitempty"`
	Ops       []wsOp          `json:"ops,omitempty"`
	Doc       *wsDoc          `json:"doc,omitempty"`
	Self      *wsPeer         `json:"self,omitempty"`
	Peers     []*wsPeer       `json:"peers,omitempty"`
	Peer      *wsPeer         `json:"peer,omitempty"`
	Event     string          `json:"event,omitempty"`
	Cursor    *wsCursor       `json:"cursor,omitempty"`
	Selection []string        `json:"selection,omitempty"`
	Raw       json.RawMessage `json:"-"`
}

var peerColors = []string{
	"#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
	"#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
}

type wsClient struct {
	id    string
	name  string
	color string
	conn  *websocket.Conn
	send  chan []byte
	room  *wsRoom
}

type wsRoom struct {
	id      string
	hub     *wsHub
	mu      sync.Mutex
	clients map[*wsClient]bool
	nodes   map[string]json.RawMessage
	edges   map[string]json.RawMessage
	name    string
	saveT   *time.Timer
	dirty   bool
}

type wsHub struct {
	mu    sync.Mutex
	rooms map[string]*wsRoom
	store *Store
}

func newWSHub(store *Store) *wsHub {
	return &wsHub{rooms: map[string]*wsRoom{}, store: store}
}

func (h *wsHub) room(d Diagram) *wsRoom {
	h.mu.Lock()
	defer h.mu.Unlock()
	if r, ok := h.rooms[d.ID]; ok {
		return r
	}
	r := &wsRoom{id: d.ID, hub: h, clients: map[*wsClient]bool{}, nodes: map[string]json.RawMessage{}, edges: map[string]json.RawMessage{}}
	r.load(d)
	h.rooms[d.ID] = r
	return r
}

func (h *wsHub) drop(r *wsRoom) {
	h.mu.Lock()
	if h.rooms[r.id] == r {
		delete(h.rooms, r.id)
	}
	h.mu.Unlock()
}

func (r *wsRoom) load(d Diagram) {
	var raw struct {
		Name  string            `json:"name"`
		Nodes []json.RawMessage `json:"nodes"`
		Edges []json.RawMessage `json:"edges"`
	}
	_ = json.Unmarshal(d.Data, &raw)
	r.name = d.Name
	for _, n := range raw.Nodes {
		if id := jsonID(n); id != "" {
			r.nodes[id] = n
		}
	}
	for _, e := range raw.Edges {
		if id := jsonID(e); id != "" {
			r.edges[id] = e
		}
	}
}

func jsonID(v json.RawMessage) string {
	var o struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(v, &o)
	return o.ID
}

// apply mutates the authoritative document. Caller holds r.mu.
func (r *wsRoom) apply(op wsOp) {
	empty := len(op.V) == 0 || string(op.V) == "null"
	switch op.K {
	case "node":
		if empty {
			delete(r.nodes, op.ID)
		} else {
			r.nodes[op.ID] = op.V
		}
	case "edge":
		if empty {
			delete(r.edges, op.ID)
		} else {
			r.edges[op.ID] = op.V
		}
	case "meta":
		if op.Name != "" {
			r.name = op.Name
		}
	}
}

func (r *wsRoom) snapshot() wsDoc {
	r.mu.Lock()
	defer r.mu.Unlock()
	nodes := make([]json.RawMessage, 0, len(r.nodes))
	for _, v := range r.nodes {
		nodes = append(nodes, v)
	}
	edges := make([]json.RawMessage, 0, len(r.edges))
	for _, v := range r.edges {
		edges = append(edges, v)
	}
	return wsDoc{Name: r.name, Nodes: nodes, Edges: edges}
}

func (r *wsRoom) peers(except string) []*wsPeer {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := []*wsPeer{}
	for c := range r.clients {
		if c.id == except {
			continue
		}
		out = append(out, &wsPeer{ID: c.id, Name: c.name, Color: c.color})
	}
	return out
}

func (r *wsRoom) broadcast(from string, msg []byte) {
	r.mu.Lock()
	targets := make([]*wsClient, 0, len(r.clients))
	for c := range r.clients {
		if c.id == from {
			continue
		}
		targets = append(targets, c)
	}
	r.mu.Unlock()
	for _, c := range targets {
		c.trySend(msg)
	}
}

func (r *wsRoom) broadcastAll(msg []byte) {
	r.mu.Lock()
	targets := make([]*wsClient, 0, len(r.clients))
	for c := range r.clients {
		targets = append(targets, c)
	}
	r.mu.Unlock()
	for _, c := range targets {
		c.trySend(msg)
	}
}

func (r *wsRoom) scheduleSave() {
	r.mu.Lock()
	r.dirty = true
	if r.saveT != nil {
		r.saveT.Stop()
	}
	r.saveT = time.AfterFunc(800*time.Millisecond, r.save)
	r.mu.Unlock()
}

func (r *wsRoom) save() {
	r.mu.Lock()
	if !r.dirty {
		r.mu.Unlock()
		return
	}
	r.dirty = false
	doc := wsDoc{Name: r.name}
	for _, v := range r.nodes {
		doc.Nodes = append(doc.Nodes, v)
	}
	for _, v := range r.edges {
		doc.Edges = append(doc.Edges, v)
	}
	name := r.name
	r.mu.Unlock()
	if doc.Nodes == nil {
		doc.Nodes = []json.RawMessage{}
	}
	if doc.Edges == nil {
		doc.Edges = []json.RawMessage{}
	}
	data, err := json.Marshal(map[string]any{"nodes": doc.Nodes, "edges": doc.Edges})
	if err != nil {
		return
	}
	_ = r.hub.store.SaveDocData(r.id, name, data)
}

func (c *wsClient) trySend(msg []byte) {
	select {
	case c.send <- msg:
	default:
		// Slow client: drop the message rather than blocking the room.
	}
}

// ---------------- HTTP ----------------

func (a *API) WebSocket(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		writeErr(w, http.StatusBadRequest, "missing token")
		return
	}
	d, err := a.store.GetByEditToken(token)
	if errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "edit link not found or disabled")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load diagram")
		return
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
	if err != nil {
		return
	}
	conn.SetReadLimit(8 << 20)

	room := a.ws.room(d)
	name := truncate(r.URL.Query().Get("name"), 32)
	if name == "" {
		name = "Guest"
	}
	c := &wsClient{
		id:    "p_" + newID(),
		name:  name,
		color: peerColors[rand.Intn(len(peerColors))],
		conn:  conn,
		send:  make(chan []byte, 64),
		room:  room,
	}
	room.mu.Lock()
	room.clients[c] = true
	room.mu.Unlock()

	// init
	initMsg, _ := json.Marshal(wsOut{
		T:     "init",
		Self:  &wsPeer{ID: c.id, Name: c.name, Color: c.color},
		Doc:   ptrDoc(room.snapshot()),
		Peers: room.peers(c.id),
	})
	c.trySend(initMsg)

	// tell others
	joinMsg, _ := json.Marshal(wsOut{T: "peer", Event: "join", Peer: &wsPeer{ID: c.id, Name: c.name, Color: c.color}})
	room.broadcast(c.id, joinMsg)

	go c.writeLoop()
	c.readLoop(a.ws)

	// teardown
	room.mu.Lock()
	delete(room.clients, c)
	empty := len(room.clients) == 0
	room.mu.Unlock()
	leaveMsg, _ := json.Marshal(wsOut{T: "peer", Event: "leave", Peer: &wsPeer{ID: c.id}})
	room.broadcast(c.id, leaveMsg)
	if empty {
		room.save()
		a.ws.drop(room)
	}
}

func ptrDoc(d wsDoc) *wsDoc { return &d }

func (c *wsClient) writeLoop() {
	ctx := context.Background()
	ping := time.NewTicker(25 * time.Second)
	defer ping.Stop()
	for {
		select {
		case msg, ok := <-c.send:
			if !ok {
				return
			}
			wctx, cancel := context.WithTimeout(ctx, 10*time.Second)
			err := c.conn.Write(wctx, websocket.MessageText, msg)
			cancel()
			if err != nil {
				return
			}
		case <-ping.C:
			pctx, cancel := context.WithTimeout(ctx, 10*time.Second)
			err := c.conn.Ping(pctx)
			cancel()
			if err != nil {
				return
			}
		}
	}
}

func (c *wsClient) readLoop(h *wsHub) {
	ctx := context.Background()
	for {
		typ, data, err := c.conn.Read(ctx)
		if err != nil {
			break
		}
		if typ != websocket.MessageText {
			continue
		}
		var in wsIn
		if err := json.Unmarshal(data, &in); err != nil {
			continue
		}
		switch in.T {
		case "hello":
			if in.Name != "" {
				c.name = truncate(in.Name, 32)
			}
		case "ops":
			if len(in.Ops) == 0 {
				continue
			}
			room := c.room
			room.mu.Lock()
			for _, op := range in.Ops {
				room.apply(op)
			}
			room.mu.Unlock()
			msg, _ := json.Marshal(wsOut{T: "ops", From: c.id, Ops: in.Ops})
			room.broadcast(c.id, msg)
			room.scheduleSave()
		case "presence":
			msg, _ := json.Marshal(wsOut{
				T:         "presence",
				From:      c.id,
				Cursor:    in.Cursor,
				Selection: in.Selection,
			})
			c.room.broadcast(c.id, msg)
		}
	}
	close(c.send)
	_ = c.conn.CloseNow()
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
