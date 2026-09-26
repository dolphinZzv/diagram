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
	case "diagram_publish":
		return s.toolDiagramPublish(args)
	case "diagram_unpublish":
		return s.toolDiagramUnpublish(args)
	case "diagram_compose":
		return s.toolDiagramCompose(args)
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
	case "component_list":
		return s.toolComponentList()
	case "component_get":
		return s.toolComponentGet(args)
	case "component_create":
		return s.toolComponentCreate(args)
	case "component_apply":
		return s.toolComponentApply(args)
	case "component_delete":
		return s.toolComponentDelete(args)
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
			"name":        "diagram_publish",
			"description": "Publish the current draft so the read-only share link/images show it.",
			"inputSchema": obj(map[string]any{"id": strProp("diagram id")}, "id"),
		},
		{
			"name":        "diagram_unpublish",
			"description": "Remove the published snapshot (share falls back to the current data).",
			"inputSchema": obj(map[string]any{"id": strProp("diagram id")}, "id"),
		},
		{
			"name":        "diagram_compose",
			"description": "Create a whole diagram from a declarative graph in ONE call. Describe nodes and edges by relationship; the server lays them out automatically, so you never compute x/y. Prefer this over many node_add/edge_add calls.",
			"inputSchema": obj(map[string]any{
				"name":        strProp("diagram name"),
				"description": strProp("optional description"),
				"direction":   strProp("layout direction: TB (top-to-bottom, default) or LR (left-to-right)"),
				"nodes": map[string]any{
					"type":        "array",
					"description": "nodes; the `id` is your own local reference used by edges",
					"items": obj(map[string]any{
						"id":        strProp("local reference id (referenced by edges)"),
						"label":     strProp("node text"),
						"shape":     strProp("rect|rounded|ellipse|diamond|hexagon|triangle|parallelogram|cylinder|document|star|cloud|text"),
						"fill":      strProp("fill color, e.g. #ffffff"),
						"stroke":    strProp("border color"),
						"textColor": strProp("text color"),
						"width":     numProp("width"),
						"height":    numProp("height"),
					}),
				},
				"edges": map[string]any{
					"type": "array",
					"items": obj(map[string]any{
						"from":         strProp("source node id (local reference)"),
						"to":           strProp("target node id (local reference)"),
						"label":        strProp("edge label"),
						"color":        strProp("line color"),
						"pathType":     strProp("bezier|straight|step|smoothstep"),
						"arrowType":    strProp("arrowclosed|arrow|diamond|none"),
						"lineStyle":    strProp("solid|dashed|dotted"),
						"sourceHandle": strProp("optional handle override: t|r|b|l"),
						"targetHandle": strProp("optional handle override: t|r|b|l"),
					}, "from", "to"),
				},
			}, "name", "nodes"),
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
		{
			"name":        "component_list",
			"description": "List reusable components in the shared library.",
			"inputSchema": obj(map[string]any{}),
		},
		{
			"name":        "component_get",
			"description": "Get a component's nodes/edges by id.",
			"inputSchema": obj(map[string]any{"id": strProp("component id")}, "id"),
		},
		{
			"name":        "component_create",
			"description": "Create (or update) a reusable component from nodes/edges.",
			"inputSchema": obj(map[string]any{
				"id":       strProp("optional component id"),
				"name":     strProp("component name"),
				"category": strProp("category"),
				"kind":     strProp("single | compound"),
				"nodes":    map[string]any{"type": "array", "items": map[string]any{"type": "object"}},
				"edges":    map[string]any{"type": "array", "items": map[string]any{"type": "object"}},
			}, "name", "nodes"),
		},
		{
			"name":        "component_apply",
			"description": "Insert a component's nodes/edges into a diagram at an optional offset.",
			"inputSchema": obj(map[string]any{
				"diagramId":   strProp("diagram id"),
				"componentId": strProp("component id"),
				"x":           numProp("x offset"),
				"y":           numProp("y offset"),
			}, "diagramId", "componentId"),
		},
		{
			"name":        "component_delete",
			"description": "Delete a component from the shared library.",
			"inputSchema": obj(map[string]any{"id": strProp("component id")}, "id"),
		},
	}
}

// ---------------- tool implementations ----------------

func (s *mcpServer) toolComponentList() (string, error) {
	items, err := s.store.ListComponents()
	if err != nil {
		return "", err
	}
	for i := range items {
		items[i].Data = nil // metadata only
	}
	return jsonText(items)
}

func (s *mcpServer) toolComponentGet(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	c, err := s.store.GetComponent(id)
	if err != nil {
		return "", err
	}
	var doc DiagramDoc
	_ = json.Unmarshal(c.Data, &doc)
	return jsonText(map[string]any{
		"id": c.ID, "name": c.Name, "category": c.Category, "kind": c.Kind,
		"nodes": doc.Nodes, "edges": doc.Edges,
	})
}

func (s *mcpServer) toolComponentCreate(args map[string]any) (string, error) {
	name, err := requiredString(args, "name")
	if err != nil {
		return "", err
	}
	nodes, _ := args["nodes"].([]any)
	edges, _ := args["edges"].([]any)
	if len(nodes) == 0 {
		return "", fmt.Errorf("nodes must not be empty")
	}
	data, _ := json.Marshal(map[string]any{"nodes": nodes, "edges": edges})
	id, _ := optionalString(args, "id")
	category, _ := optionalString(args, "category")
	kind, _ := optionalString(args, "kind")
	if kind == "" {
		kind = "single"
		if len(nodes) > 1 {
			kind = "compound"
		}
	}
	out, err := s.store.UpsertComponent(Component{
		ID: id, Name: name, Category: category, Kind: kind, Data: data,
	})
	if err != nil {
		return "", err
	}
	return jsonText(map[string]any{"id": out.ID, "name": out.Name, "category": out.Category, "kind": out.Kind})
}

func (s *mcpServer) toolComponentApply(args map[string]any) (string, error) {
	diagramID, err := requiredString(args, "diagramId")
	if err != nil {
		return "", err
	}
	componentID, err := requiredString(args, "componentId")
	if err != nil {
		return "", err
	}
	comp, err := s.store.GetComponent(componentID)
	if err != nil {
		return "", err
	}
	var frag DiagramDoc
	if err := json.Unmarshal(comp.Data, &frag); err != nil {
		return "", fmt.Errorf("invalid component data: %w", err)
	}
	doc, _, err := s.loadDoc(diagramID)
	if err != nil {
		return "", err
	}
	dx := numberArg(args, "x", 0)
	dy := numberArg(args, "y", 0)

	idMap := map[string]string{}
	for _, n := range frag.Nodes {
		idMap[asString(n["id"])] = "n_" + newID()
	}
	for _, n := range frag.Nodes {
		nn := map[string]any{}
		for k, v := range n {
			nn[k] = v
		}
		nn["id"] = idMap[asString(n["id"])]
		if parent, ok := n["parentId"].(string); ok {
			if mapped, ok := idMap[parent]; ok {
				nn["parentId"] = mapped
			}
		}
		pos, _ := n["position"].(map[string]any)
		nn["position"] = map[string]any{
			"x": toFloat(pos["x"]) + dx,
			"y": toFloat(pos["y"]) + dy,
		}
		doc.Nodes = append(doc.Nodes, nn)
	}
	for _, e := range frag.Edges {
		ee := map[string]any{}
		for k, v := range e {
			ee[k] = v
		}
		ee["id"] = "e_" + newID()
		ee["source"] = idMap[asString(e["source"])]
		ee["target"] = idMap[asString(e["target"])]
		doc.Edges = append(doc.Edges, ee)
	}
	saved, err := s.saveDoc(diagramID, doc, "mcp")
	if err != nil {
		return "", err
	}
	return saved, nil
}

func (s *mcpServer) toolComponentDelete(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	if err := s.store.DeleteComponent(id); err != nil {
		return "", err
	}
	return jsonText(map[string]any{"status": "deleted", "id": id})
}

func toFloat(v any) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case int:
		return float64(n)
	case json.Number:
		f, _ := n.Float64()
		return f
	}
	return 0
}

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
		ID:          newUUID(),
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

func (s *mcpServer) toolDiagramPublish(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	ts, err := s.store.Publish(id)
	if err != nil {
		return "", err
	}
	return jsonText(map[string]any{"published": true, "publishedAt": ts})
}

func (s *mcpServer) toolDiagramUnpublish(args map[string]any) (string, error) {
	id, err := requiredString(args, "id")
	if err != nil {
		return "", err
	}
	if err := s.store.Unpublish(id); err != nil {
		return "", err
	}
	return jsonText(map[string]any{"published": false})
}

// toolDiagramCompose builds a whole diagram from a declarative graph and lays
// it out server-side, so agents never have to compute coordinates.
func (s *mcpServer) toolDiagramCompose(args map[string]any) (string, error) {
	name, err := requiredString(args, "name")
	if err != nil {
		return "", err
	}
	desc, _ := optionalString(args, "description")
	direction, _ := optionalString(args, "direction")
	if direction != "LR" {
		direction = "TB"
	}
	rawNodes, _ := args["nodes"].([]any)
	if len(rawNodes) == 0 {
		return "", fmt.Errorf("nodes must be a non-empty array")
	}
	rawEdges, _ := args["edges"].([]any)

	nodeIDByKey := map[string]string{}
	doc := DiagramDoc{Nodes: []map[string]any{}, Edges: []map[string]any{}}
	layoutNodes := make([]layoutNode, 0, len(rawNodes))

	for i, raw := range rawNodes {
		m, ok := raw.(map[string]any)
		if !ok {
			return "", fmt.Errorf("nodes[%d] must be an object", i)
		}
		key, _ := optionalString(m, "id")
		if key == "" {
			key = fmt.Sprintf("n%d", i)
		}
		if _, dup := nodeIDByKey[key]; dup {
			return "", fmt.Errorf("duplicate node id: %s", key)
		}
		shape, _ := optionalString(m, "shape")
		if shape == "" {
			shape = "rect"
		}
		w := numberArg(m, "width", 0)
		h := numberArg(m, "height", 0)
		if w <= 0 || h <= 0 {
			dw, dh := shapeSize(shape)
			if w <= 0 {
				w = dw
			}
			if h <= 0 {
				h = dh
			}
		}
		label, _ := optionalString(m, "label")
		fill, _ := optionalString(m, "fill")
		stroke, _ := optionalString(m, "stroke")
		textColor, _ := optionalString(m, "textColor")
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
		nodeIDByKey[key] = nodeID
		doc.Nodes = append(doc.Nodes, map[string]any{
			"id": nodeID, "type": "shape",
			"position": map[string]any{"x": 0.0, "y": 0.0},
			"data": map[string]any{
				"shape": shape, "label": label, "fill": fill, "stroke": stroke,
				"strokeWidth": 2.0, "rotation": 0.0, "width": w, "height": h,
				"fontSize": 14.0, "textColor": textColor, "opacity": 1.0, "radius": 8.0,
				"fontWeight": "normal", "fontStyle": "normal", "locked": false,
			},
			"style": map[string]any{"width": w, "height": h},
		})
		layoutNodes = append(layoutNodes, layoutNode{ID: nodeID, W: w, H: h})
	}

	layoutEdges := make([]layoutEdge, 0, len(rawEdges))
	for i, raw := range rawEdges {
		m, ok := raw.(map[string]any)
		if !ok {
			return "", fmt.Errorf("edges[%d] must be an object", i)
		}
		from, _ := optionalString(m, "from")
		to, _ := optionalString(m, "to")
		src, ok1 := nodeIDByKey[from]
		dst, ok2 := nodeIDByKey[to]
		if !ok1 || !ok2 {
			return "", fmt.Errorf("edges[%d]: from/to must reference a node id", i)
		}
		label, _ := optionalString(m, "label")
		color, _ := optionalString(m, "color")
		pathType, _ := optionalString(m, "pathType")
		arrowType, _ := optionalString(m, "arrowType")
		lineStyle, _ := optionalString(m, "lineStyle")
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
		sourceHandle, targetHandle := "b", "t"
		if direction == "LR" {
			sourceHandle, targetHandle = "r", "l"
		}
		if v, _ := optionalString(m, "sourceHandle"); v != "" {
			sourceHandle = v
		}
		if v, _ := optionalString(m, "targetHandle"); v != "" {
			targetHandle = v
		}
		doc.Edges = append(doc.Edges, map[string]any{
			"id": "e_" + newID(), "source": src, "target": dst, "type": "custom",
			"sourceHandle": sourceHandle, "targetHandle": targetHandle,
			"data": map[string]any{
				"label": label, "color": color, "width": 2.0, "lineStyle": lineStyle,
				"arrowType": arrowType, "startArrowType": "none", "pathType": pathType,
				"labelRotation": 0.0, "animated": false, "points": []any{},
			},
		})
		layoutEdges = append(layoutEdges, layoutEdge{Source: src, Target: dst})
	}

	positions := layoutLayered(layoutNodes, layoutEdges, direction)
	for _, n := range doc.Nodes {
		if p, ok := positions[asString(n["id"])]; ok {
			n["position"] = map[string]any{"x": p[0], "y": p[1]}
		}
	}

	data, err := json.Marshal(doc)
	if err != nil {
		return "", err
	}
	d := Diagram{
		ID:          newUUID(),
		Name:        name,
		Description: desc,
		Data:        data,
		CreatedAt:   nowISO(),
		UpdatedAt:   nowISO(),
	}
	if err := s.store.Create(d); err != nil {
		return "", err
	}
	_, _ = s.store.CreateVersion(DiagramVersion{DiagramID: d.ID, Label: "创建", Origin: "create", Data: d.Data})
	return jsonText(map[string]any{"id": d.ID, "name": d.Name, "nodes": len(doc.Nodes), "edges": len(doc.Edges)})
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
