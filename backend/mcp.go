package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
)

// DiagramDoc is the editor payload shape shared with the frontend.
type DiagramDoc struct {
	Nodes    []map[string]any `json:"nodes"`
	Edges    []map[string]any `json:"edges"`
	Viewport map[string]any   `json:"viewport,omitempty"`
}

type mcpServer struct {
	store *Store
}

// ---------------- JSON-RPC plumbing ----------------

type rpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Result  any             `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

const mcpProtocolVersion = "2024-11-05"

func runMCPServer(dbPath string) error {
	store, err := NewStore(dbPath)
	if err != nil {
		return err
	}
	defer store.Close()

	srv := &mcpServer{store: store}
	// Protocol messages go to stdout; logs MUST go to stderr.
	log.SetOutput(os.Stderr)
	log.SetPrefix("diagram-mcp: ")
	log.Printf("MCP server started (db: %s)", dbPath)

	reader := bufio.NewReaderSize(os.Stdin, 4<<20)
	writer := bufio.NewWriter(os.Stdout)
	defer writer.Flush()

	for {
		line, err := readLine(reader)
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		resp := srv.handle([]byte(line))
		if resp == nil {
			continue
		}
		if _, err := writer.Write(resp); err != nil {
			return err
		}
		if err := writer.WriteByte('\n'); err != nil {
			return err
		}
		if err := writer.Flush(); err != nil {
			return err
		}
	}
}

func readLine(r *bufio.Reader) (string, error) {
	var sb strings.Builder
	for {
		chunk, err := r.ReadString('\n')
		sb.WriteString(chunk)
		if err != nil {
			if err == io.EOF && sb.Len() > 0 {
				return sb.String(), nil
			}
			return sb.String(), err
		}
		if strings.HasSuffix(chunk, "\n") {
			return sb.String(), nil
		}
	}
}

// handle processes a single JSON-RPC message and returns the encoded response
// (or nil for notifications).
func (s *mcpServer) handle(raw []byte) []byte {
	var req rpcRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		return encode(rpcResponse{
			JSONRPC: "2.0",
			Error:   &rpcError{Code: -32700, Message: "parse error"},
		})
	}

	// Notifications have no id and expect no response.
	notification := len(req.ID) == 0
	if notification {
		return nil
	}

	switch req.Method {
	case "initialize":
		return encode(rpcResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]any{
				"protocolVersion": mcpProtocolVersion,
				"capabilities":    map[string]any{"tools": map[string]any{}},
				"serverInfo":      map[string]any{"name": "diagram", "version": version},
			},
		})
	case "ping":
		return encode(rpcResponse{JSONRPC: "2.0", ID: req.ID, Result: map[string]any{}})
	case "tools/list":
		return encode(rpcResponse{JSONRPC: "2.0", ID: req.ID, Result: map[string]any{"tools": s.toolDefs()}})
	case "tools/call":
		var params struct {
			Name      string         `json:"name"`
			Arguments map[string]any `json:"arguments"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil {
			return encode(rpcResponse{JSONRPC: "2.0", ID: req.ID, Error: &rpcError{Code: -32602, Message: "invalid params"}})
		}
		text, err := s.callTool(params.Name, params.Arguments)
		if err != nil {
			return encode(rpcResponse{
				JSONRPC: "2.0",
				ID:      req.ID,
				Result: map[string]any{
					"content": []map[string]any{{"type": "text", "text": err.Error()}},
					"isError": true,
				},
			})
		}
		return encode(rpcResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result:  map[string]any{"content": []map[string]any{{"type": "text", "text": text}}},
		})
	default:
		return encode(rpcResponse{JSONRPC: "2.0", ID: req.ID, Error: &rpcError{Code: -32601, Message: "method not found: " + req.Method}})
	}
}

func encode(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return []byte(`{"jsonrpc":"2.0","error":{"code":-32603,"message":"internal error"}}`)
	}
	return b
}

// ---------------- HTTP (Streamable HTTP) transport ----------------

// mcpHTTPHandler exposes the MCP server over HTTP so remote agents can connect
// to a running diagram server instead of spawning a local process.
//
// It implements the MCP "Streamable HTTP" transport:
//   - POST /mcp : JSON-RPC request; responds with JSON, or an SSE stream when
//     the client sends "Accept: text/event-stream".
//   - GET  /mcp : not supported (no server-initiated stream) -> 405.
//   - DELETE /mcp : ends the session -> 200.
func mcpHTTPHandler(s *mcpServer) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodOptions:
			w.WriteHeader(http.StatusNoContent)
			return
		case http.MethodPost:
			body, err := io.ReadAll(io.LimitReader(r.Body, 8<<20))
			if err != nil {
				http.Error(w, "failed to read body", http.StatusBadRequest)
				return
			}
			// Reuse an existing session id, or create one for this exchange.
			session := r.Header.Get("Mcp-Session-Id")
			if session == "" {
				session = newShareToken()
			}
			w.Header().Set("Mcp-Session-Id", session)

			resp := s.handle(body)

			if strings.Contains(r.Header.Get("Accept"), "text/event-stream") {
				w.Header().Set("Content-Type", "text/event-stream")
				w.Header().Set("Cache-Control", "no-cache")
				w.Header().Set("Connection", "keep-alive")
				w.WriteHeader(http.StatusOK)
				if resp != nil {
					_, _ = fmt.Fprintf(w, "event: message\ndata: %s\n\n", resp)
				}
				if f, ok := w.(http.Flusher); ok {
					f.Flush()
				}
				return
			}

			// Notifications (no id) produce no reply.
			if resp == nil {
				w.WriteHeader(http.StatusAccepted)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(resp)

		case http.MethodDelete:
			// Stateless server: nothing to tear down.
			w.WriteHeader(http.StatusOK)

		default:
			w.Header().Set("Allow", "POST, DELETE, OPTIONS")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
}

// ---------------- tools ----------------

func (s *mcpServer) callTool(name string, args map[string]any) (string, error) {
	switch name {
	case "diagram_list":
		return s.toolDiagramList()
	case "diagram_get":
		return s.toolDiagramGet(args)
	case "diagram_create":
		return s.toolDiagramCreate(args)
	case "diagram_update":
		return s.toolDiagramUpdate(args)
	case "diagram_delete":
		return s.toolDiagramDelete(args)
	case "node_add":
		return s.toolNodeAdd(args)
	case "node_update":
		return s.toolNodeUpdate(args)
	case "node_remove":
		return s.toolNodeRemove(args)
	case "edge_add":
		return s.toolEdgeAdd(args)
	case "edge_update":
		return s.toolEdgeUpdate(args)
	case "edge_remove":
		return s.toolEdgeRemove(args)
	case "version_list":
		return s.toolVersionList(args)
	case "version_create":
		return s.toolVersionCreate(args)
	case "version_restore":
		return s.toolVersionRestore(args)
	case "share_enable":
		return s.toolShareEnable(args)
	case "share_get":
		return s.toolShareGet(args)
	case "share_disable":
		return s.toolShareDisable(args)
	default:
		return "", fmt.Errorf("unknown tool: %s", name)
	}
}

func (s *mcpServer) toolDefs() []map[string]any {
	strProp := func(desc string) map[string]any { return map[string]any{"type": "string", "description": desc} }
	numProp := func(desc string) map[string]any { return map[string]any{"type": "number", "description": desc} }
	obj := func(props map[string]any, required ...string) map[string]any {
		m := map[string]any{"type": "object", "properties": props}
		if len(required) > 0 {
			m["required"] = required
		}
		return m
	}

	return []map[string]any{
		{
			"name":        "diagram_list",
			"description": "List all saved diagrams (id, name, updatedAt).",
			"inputSchema": obj(map[string]any{}),
		},
		{
			"name":        "diagram_get",
			"description": "Get a diagram's full data (nodes/edges) by id.",
			"inputSchema": obj(map[string]any{"id": strProp("diagram id")}, "id"),
		},
		{
			"name":        "diagram_create",
			"description": "Create a new empty diagram and return its id.",
			"inputSchema": obj(map[string]any{
				"name":        strProp("diagram name"),
				"description": strProp("optional description"),
			}, "name"),
		},
		{
			"name":        "diagram_update",
			"description": "Replace a diagram's data with the provided {nodes, edges} document.",
			"inputSchema": obj(map[string]any{
				"id":   strProp("diagram id"),
				"data": map[string]any{"type": "object", "description": "diagram document: {nodes:[], edges:[]}"},
			}, "id", "data"),
		},
		{
			"name":        "diagram_delete",
			"description": "Delete a diagram by id.",
			"inputSchema": obj(map[string]any{"id": strProp("diagram id")}, "id"),
		},
		{
			"name":        "node_add",
			"description": "Add a node to a diagram. shape is one of: rect, rounded, ellipse, diamond, hexagon, triangle, parallelogram, cylinder, document, star, cloud, text.",
			"inputSchema": obj(map[string]any{
				"id":        strProp("diagram id"),
				"shape":     strProp("shape type (default rect)"),
				"label":     strProp("node text"),
				"x":         numProp("x position"),
				"y":         numProp("y position"),
				"fill":      strProp("fill color, e.g. #ffffff"),
				"stroke":    strProp("border color"),
				"textColor": strProp("text color"),
				"width":     numProp("width"),
				"height":    numProp("height"),
				"rotation":  numProp("rotation in degrees"),
			}, "id", "x", "y"),
		},
		{
			"name":        "node_update",
			"description": "Update fields of an existing node (label, fill, stroke, textColor, width, height, rotation, shape, opacity, locked).",
			"inputSchema": obj(map[string]any{
				"id":     strProp("diagram id"),
				"nodeId": strProp("node id"),
				"patch":  map[string]any{"type": "object", "description": "fields to merge into the node data"},
			}, "id", "nodeId", "patch"),
		},
		{
			"name":        "node_remove",
			"description": "Remove one or more nodes (and their connected edges).",
			"inputSchema": obj(map[string]any{
				"id":      strProp("diagram id"),
				"nodeIds": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			}, "id", "nodeIds"),
		},
		{
			"name":        "edge_add",
			"description": "Connect two nodes with an edge.",
			"inputSchema": obj(map[string]any{
				"id":           strProp("diagram id"),
				"source":       strProp("source node id"),
				"target":       strProp("target node id"),
				"sourceHandle": strProp("source handle: t|r|b|l"),
				"targetHandle": strProp("target handle: t|r|b|l"),
				"label":        strProp("edge label"),
				"color":        strProp("line color"),
				"pathType":     strProp("bezier|straight|step|smoothstep"),
				"arrowType":    strProp("arrowclosed|arrow|diamond|none"),
				"lineStyle":    strProp("solid|dashed|dotted"),
				"animated":     map[string]any{"type": "boolean"},
			}, "id", "source", "target"),
		},
		{
			"name":        "edge_update",
			"description": "Update fields of an existing edge.",
			"inputSchema": obj(map[string]any{
				"id":     strProp("diagram id"),
				"edgeId": strProp("edge id"),
				"patch":  map[string]any{"type": "object", "description": "fields to merge into the edge data"},
			}, "id", "edgeId", "patch"),
		},
		{
			"name":        "edge_remove",
			"description": "Remove one or more edges.",
			"inputSchema": obj(map[string]any{
				"id":      strProp("diagram id"),
				"edgeIds": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
			}, "id", "edgeIds"),
		},
		{
			"name":        "version_list",
			"description": "List a diagram's version history.",
			"inputSchema": obj(map[string]any{"id": strProp("diagram id")}, "id"),
		},
		{
			"name":        "version_create",
			"description": "Create a manual snapshot of the current diagram.",
			"inputSchema": obj(map[string]any{
				"id":    strProp("diagram id"),
				"label": strProp("snapshot label"),
			}, "id"),
		},
		{
			"name":        "version_restore",
			"description": "Restore a diagram to a previous version.",
			"inputSchema": obj(map[string]any{
				"id":      strProp("diagram id"),
				"version": numProp("version number"),
			}, "id", "version"),
		},
		{
			"name":        "share_enable",
			"description": "Enable (or rotate) a read-only share link and return its token.",
			"inputSchema": obj(map[string]any{"id": strProp("diagram id")}, "id"),
		},
		{
			"name":        "share_get",
			"description": "Get the current share token for a diagram.",
			"inputSchema": obj(map[string]any{"id": strProp("diagram id")}, "id"),
		},
		{
			"name":        "share_disable",
			"description": "Disable sharing for a diagram.",
			"inputSchema": obj(map[string]any{"id": strProp("diagram id")}, "id"),
		},
	}
}

// ---------------- tool implementations ----------------

func (s *mcpServer) toolDiagramList() (string, error) {
	items, err := s.store.List()
	if err != nil {
		return "", err
	}
	out := make([]map[string]any, 0, len(items))
	for _, d := range items {
		out = append(out, map[string]any{
			"id": d.ID, "name": d.Name, "description": d.Description,
			"createdAt": d.CreatedAt, "updatedAt": d.UpdatedAt,
		})
	}
	return jsonText(out)
}

func (s *mcpServer) toolDiagramGet(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	d, err := s.store.Get(id)
	if err != nil {
		return "", err
	}
	var doc DiagramDoc
	if err := json.Unmarshal(d.Data, &doc); err != nil {
		return "", fmt.Errorf("diagram data is not a valid document: %w", err)
	}
	return jsonText(map[string]any{
		"id": d.ID, "name": d.Name, "description": d.Description, "data": doc,
	})
}

func (s *mcpServer) toolDiagramCreate(args map[string]any) (string, error) {
	name, err := requiredString(args, "name")
	if err != nil {
		return "", err
	}
	desc, _ := optionalString(args, "description")
	doc, _ := json.Marshal(DiagramDoc{Nodes: []map[string]any{}, Edges: []map[string]any{}})
	d := Diagram{
		ID:          newID(),
		Name:        name,
		Description: desc,
		Data:        doc,
		CreatedAt:   nowISO(),
		UpdatedAt:   nowISO(),
	}
	if err := s.store.Create(d); err != nil {
		return "", err
	}
	_, _ = s.store.CreateVersion(DiagramVersion{DiagramID: d.ID, Label: "创建", Origin: "create", Data: d.Data})
	return jsonText(map[string]any{"id": d.ID, "name": d.Name})
}

func (s *mcpServer) toolDiagramUpdate(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	raw, ok := args["data"]
	if !ok {
		return "", fmt.Errorf("missing required argument: data")
	}
	dataBytes, err := json.Marshal(raw)
	if err != nil {
		return "", err
	}
	var doc DiagramDoc
	if err := json.Unmarshal(dataBytes, &doc); err != nil {
		return "", fmt.Errorf("data must be a diagram document: %w", err)
	}
	if doc.Nodes == nil {
		doc.Nodes = []map[string]any{}
	}
	if doc.Edges == nil {
		doc.Edges = []map[string]any{}
	}
	return s.saveDoc(id, doc, "mcp")
}

func (s *mcpServer) toolDiagramDelete(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	if err := s.store.Delete(id); err != nil {
		return "", err
	}
	_ = s.store.DeleteVersionsForDiagram(id)
	_ = s.store.DeleteShareAssets(id)
	return jsonText(map[string]any{"status": "deleted", "id": id})
}

func (s *mcpServer) toolNodeAdd(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	doc, _, err := s.loadDoc(id)
	if err != nil {
		return "", err
	}
	shape, _ := optionalString(args, "shape")
	if shape == "" {
		shape = "rect"
	}
	x := numberArg(args, "x", 0)
	y := numberArg(args, "y", 0)
	w := numberArg(args, "width", 0)
	h := numberArg(args, "height", 0)
	if w <= 0 || h <= 0 {
		dw, dh := shapeSize(shape)
		if w <= 0 {
			w = dw
		}
		if h <= 0 {
			h = dh
		}
	}
	label, _ := optionalString(args, "label")
	fill, _ := optionalString(args, "fill")
	stroke, _ := optionalString(args, "stroke")
	textColor, _ := optionalString(args, "textColor")
	if fill == "" {
		fill = "#ffffff"
	}
	if stroke == "" {
		stroke = "#475569"
	}
	if textColor == "" {
		textColor = "#0f172a"
	}
	nodeID := "n_" + newID()
	node := map[string]any{
		"id":       nodeID,
		"type":     "shape",
		"position": map[string]any{"x": x, "y": y},
		"data": map[string]any{
			"shape": shape, "label": label, "fill": fill, "stroke": stroke,
			"strokeWidth": 2.0, "rotation": numberArg(args, "rotation", 0),
			"width": w, "height": h, "fontSize": 14.0, "textColor": textColor,
			"opacity": 1.0, "radius": 8.0, "fontWeight": "normal", "fontStyle": "normal",
			"locked": false,
		},
		"style": map[string]any{"width": w, "height": h},
	}
	doc.Nodes = append(doc.Nodes, node)
	if _, err := s.saveDoc(id, doc, "mcp"); err != nil {
		return "", err
	}
	return jsonText(map[string]any{"nodeId": nodeID, "shape": shape, "x": x, "y": y, "width": w, "height": h})
}

func (s *mcpServer) toolNodeUpdate(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	nodeID, err := requiredString(args, "nodeId")
	if err != nil {
		return "", err
	}
	patch, ok := args["patch"].(map[string]any)
	if !ok {
		return "", fmt.Errorf("patch must be an object")
	}
	doc, _, err := s.loadDoc(id)
	if err != nil {
		return "", err
	}
	found := false
	for _, n := range doc.Nodes {
		if n["id"] != nodeID {
			continue
		}
		found = true
		data, _ := n["data"].(map[string]any)
		if data == nil {
			data = map[string]any{}
		}
		for k, v := range patch {
			data[k] = v
		}
		n["data"] = data
		if w, ok := patch["width"]; ok {
			n["style"] = mergeStyle(n["style"], "width", w)
		}
		if h, ok := patch["height"]; ok {
			n["style"] = mergeStyle(n["style"], "height", h)
		}
	}
	if !found {
		return "", fmt.Errorf("node not found: %s", nodeID)
	}
	if _, err := s.saveDoc(id, doc, "mcp"); err != nil {
		return "", err
	}
	return jsonText(map[string]any{"nodeId": nodeID, "updated": true})
}

func (s *mcpServer) toolNodeRemove(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	ids, err := stringSlice(args, "nodeIds")
	if err != nil {
		return "", err
	}
	doc, _, err := s.loadDoc(id)
	if err != nil {
		return "", err
	}
	remove := map[string]bool{}
	for _, x := range ids {
		remove[x] = true
	}
	nodes := make([]map[string]any, 0, len(doc.Nodes))
	for _, n := range doc.Nodes {
		if !remove[asString(n["id"])] {
			nodes = append(nodes, n)
		}
	}
	edges := make([]map[string]any, 0, len(doc.Edges))
	for _, e := range doc.Edges {
		if remove[asString(e["source"])] || remove[asString(e["target"])] {
			continue
		}
		edges = append(edges, e)
	}
	doc.Nodes = nodes
	doc.Edges = edges
	if _, err := s.saveDoc(id, doc, "mcp"); err != nil {
		return "", err
	}
	return jsonText(map[string]any{"removed": ids})
}

func (s *mcpServer) toolEdgeAdd(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	source, err := requiredString(args, "source")
	if err != nil {
		return "", err
	}
	target, err := requiredString(args, "target")
	if err != nil {
		return "", err
	}
	doc, _, err := s.loadDoc(id)
	if err != nil {
		return "", err
	}
	has := func(nodeID string) bool {
		for _, n := range doc.Nodes {
			if asString(n["id"]) == nodeID {
				return true
			}
		}
		return false
	}
	if !has(source) || !has(target) {
		return "", fmt.Errorf("source or target node not found")
	}
	label, _ := optionalString(args, "label")
	color, _ := optionalString(args, "color")
	pathType, _ := optionalString(args, "pathType")
	arrowType, _ := optionalString(args, "arrowType")
	lineStyle, _ := optionalString(args, "lineStyle")
	sourceHandle, _ := optionalString(args, "sourceHandle")
	targetHandle, _ := optionalString(args, "targetHandle")
	if color == "" {
		color = "#475569"
	}
	if pathType == "" {
		pathType = "bezier"
	}
	if arrowType == "" {
		arrowType = "arrowclosed"
	}
	if lineStyle == "" {
		lineStyle = "solid"
	}
	edgeID := "e_" + newID()
	edge := map[string]any{
		"id":     edgeID,
		"source": source,
		"target": target,
		"type":   "custom",
		"data": map[string]any{
			"label": label, "color": color, "width": 2.0, "lineStyle": lineStyle,
			"arrowType": arrowType, "startArrowType": "none", "pathType": pathType,
			"labelRotation": 0.0, "animated": boolArg(args, "animated", false), "points": []any{},
		},
	}
	if sourceHandle != "" {
		edge["sourceHandle"] = sourceHandle
	}
	if targetHandle != "" {
		edge["targetHandle"] = targetHandle
	}
	doc.Edges = append(doc.Edges, edge)
	if _, err := s.saveDoc(id, doc, "mcp"); err != nil {
		return "", err
	}
	return jsonText(map[string]any{"edgeId": edgeID, "source": source, "target": target})
}

func (s *mcpServer) toolEdgeUpdate(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	edgeID, err := requiredString(args, "edgeId")
	if err != nil {
		return "", err
	}
	patch, ok := args["patch"].(map[string]any)
	if !ok {
		return "", fmt.Errorf("patch must be an object")
	}
	doc, _, err := s.loadDoc(id)
	if err != nil {
		return "", err
	}
	found := false
	for _, e := range doc.Edges {
		if e["id"] != edgeID {
			continue
		}
		found = true
		data, _ := e["data"].(map[string]any)
		if data == nil {
			data = map[string]any{}
		}
		for k, v := range patch {
			data[k] = v
		}
		e["data"] = data
	}
	if !found {
		return "", fmt.Errorf("edge not found: %s", edgeID)
	}
	if _, err := s.saveDoc(id, doc, "mcp"); err != nil {
		return "", err
	}
	return jsonText(map[string]any{"edgeId": edgeID, "updated": true})
}

func (s *mcpServer) toolEdgeRemove(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	ids, err := stringSlice(args, "edgeIds")
	if err != nil {
		return "", err
	}
	doc, _, err := s.loadDoc(id)
	if err != nil {
		return "", err
	}
	remove := map[string]bool{}
	for _, x := range ids {
		remove[x] = true
	}
	edges := make([]map[string]any, 0, len(doc.Edges))
	for _, e := range doc.Edges {
		if !remove[asString(e["id"])] {
			edges = append(edges, e)
		}
	}
	doc.Edges = edges
	if _, err := s.saveDoc(id, doc, "mcp"); err != nil {
		return "", err
	}
	return jsonText(map[string]any{"removed": ids})
}

func (s *mcpServer) toolVersionList(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	versions, err := s.store.ListVersions(id)
	if err != nil {
		return "", err
	}
	return jsonText(versions)
}

func (s *mcpServer) toolVersionCreate(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	label, _ := optionalString(args, "label")
	d, err := s.store.Get(id)
	if err != nil {
		return "", err
	}
	v, err := s.store.CreateVersion(DiagramVersion{DiagramID: id, Label: label, Origin: "manual", Data: d.Data})
	if err != nil {
		return "", err
	}
	return jsonText(v)
}

func (s *mcpServer) toolVersionRestore(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	ver := int(numberArg(args, "version", 0))
	version, err := s.store.GetVersion(id, ver)
	if err != nil {
		return "", err
	}
	d, err := s.store.Get(id)
	if err != nil {
		return "", err
	}
	d.Data = version.Data
	d.UpdatedAt = nowISO()
	if err := s.store.Update(d); err != nil {
		return "", err
	}
	nv, _ := s.store.CreateVersion(DiagramVersion{
		DiagramID: id,
		Label:     fmt.Sprintf("恢复自 v%d", ver),
		Origin:    "restore",
		Data:      version.Data,
	})
	return jsonText(map[string]any{"restoredFrom": ver, "newVersion": nv.Version})
}

func (s *mcpServer) toolShareEnable(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	if _, err := s.store.Get(id); err != nil {
		return "", err
	}
	token := newShareToken()
	if err := s.store.SetShareToken(id, token); err != nil {
		return "", err
	}
	return jsonText(map[string]any{"enabled": true, "token": token, "path": "/?share=" + token})
}

func (s *mcpServer) toolShareGet(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	token, err := s.store.GetShareToken(id)
	if err != nil {
		return "", err
	}
	return jsonText(map[string]any{"enabled": token != "", "token": token})
}

func (s *mcpServer) toolShareDisable(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	if err := s.store.SetShareToken(id, ""); err != nil {
		return "", err
	}
	return jsonText(map[string]any{"enabled": false})
}

// ---------------- helpers ----------------

func (s *mcpServer) loadDoc(id string) (DiagramDoc, Diagram, error) {
	d, err := s.store.Get(id)
	if err != nil {
		return DiagramDoc{}, d, err
	}
	var doc DiagramDoc
	if len(d.Data) > 0 {
		if err := json.Unmarshal(d.Data, &doc); err != nil {
			return doc, d, fmt.Errorf("invalid diagram data: %w", err)
		}
	}
	if doc.Nodes == nil {
		doc.Nodes = []map[string]any{}
	}
	if doc.Edges == nil {
		doc.Edges = []map[string]any{}
	}
	return doc, d, nil
}

func (s *mcpServer) saveDoc(id string, doc DiagramDoc, origin string) (string, error) {
	d, err := s.store.Get(id)
	if err != nil {
		return "", err
	}
	data, err := json.Marshal(doc)
	if err != nil {
		return "", err
	}
	d.Data = data
	d.UpdatedAt = nowISO()
	if err := s.store.Update(d); err != nil {
		return "", err
	}
	if s.store.ShouldVersion(id, data) {
		_, _ = s.store.CreateVersion(DiagramVersion{DiagramID: id, Origin: origin, Data: data})
	}
	return jsonText(map[string]any{
		"id": id, "nodes": len(doc.Nodes), "edges": len(doc.Edges), "updatedAt": d.UpdatedAt,
	})
}

func jsonText(v any) (string, error) {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func shapeSize(shape string) (float64, float64) {
	switch shape {
	case "ellipse":
		return 110, 70
	case "diamond":
		return 120, 80
	case "hexagon":
		return 130, 70
	case "triangle":
		return 110, 90
	case "cylinder":
		return 96, 96
	case "document":
		return 110, 130
	case "star":
		return 120, 110
	case "cloud":
		return 140, 90
	case "text":
		return 120, 48
	default:
		return 120, 60
	}
}

func mergeStyle(style any, key string, value any) map[string]any {
	m, _ := style.(map[string]any)
	if m == nil {
		m = map[string]any{}
	}
	m[key] = value
	return m
}

func asString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func requiredString(args map[string]any, key string) (string, error) {
	s, _ := optionalString(args, key)
	if strings.TrimSpace(s) == "" {
		return "", fmt.Errorf("missing required argument: %s", key)
	}
	return s, nil
}

func optionalString(args map[string]any, key string) (string, bool) {
	v, ok := args[key]
	if !ok || v == nil {
		return "", false
	}
	if s, ok := v.(string); ok {
		return s, true
	}
	return fmt.Sprintf("%v", v), true
}

func numberArg(args map[string]any, key string, def float64) float64 {
	v, ok := args[key]
	if !ok || v == nil {
		return def
	}
	switch n := v.(type) {
	case float64:
		return n
	case int:
		return float64(n)
	case json.Number:
		f, err := n.Float64()
		if err == nil {
			return f
		}
	}
	return def
}

func boolArg(args map[string]any, key string, def bool) bool {
	v, ok := args[key]
	if !ok || v == nil {
		return def
	}
	if b, ok := v.(bool); ok {
		return b
	}
	return def
}

func stringSlice(args map[string]any, key string) ([]string, error) {
	v, ok := args[key]
	if !ok || v == nil {
		return nil, fmt.Errorf("missing required argument: %s", key)
	}
	arr, ok := v.([]any)
	if !ok {
		return nil, fmt.Errorf("%s must be an array", key)
	}
	out := make([]string, 0, len(arr))
	for _, item := range arr {
		out = append(out, asString(item))
	}
	return out, nil
}
