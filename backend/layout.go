package main

// layoutNode / layoutEdge are the minimal inputs the layered layout needs.
type layoutNode struct {
	ID string
	W  float64
	H  float64
}

type layoutEdge struct {
	Source string
	Target string
}

// layoutLayered assigns nodes to layers by longest-path from the sources, then
// spreads each layer along the cross axis and centres it. It mirrors
// frontend/src/lib/layout.ts so MCP-composed diagrams and editor auto-layout
// produce the same result.
func layoutLayered(nodes []layoutNode, edges []layoutEdge, direction string) map[string][2]float64 {
	positions := map[string][2]float64{}
	if len(nodes) == 0 {
		return positions
	}

	ids := make(map[string]bool, len(nodes))
	indeg := make(map[string]int, len(nodes))
	adj := make(map[string][]string, len(nodes))
	for _, n := range nodes {
		ids[n.ID] = true
		indeg[n.ID] = 0
	}
	for _, e := range edges {
		if !ids[e.Source] || !ids[e.Target] || e.Source == e.Target {
			continue
		}
		adj[e.Source] = append(adj[e.Source], e.Target)
		indeg[e.Target]++
	}

	// Longest-path layering (Kahn order).
	layer := make(map[string]int, len(nodes))
	remaining := make(map[string]int, len(nodes))
	for id, deg := range indeg {
		remaining[id] = deg
	}
	queue := make([]string, 0, len(nodes))
	for id, deg := range indeg {
		if deg == 0 {
			queue = append(queue, id)
			layer[id] = 0
		}
	}
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		for _, next := range adj[id] {
			if layer[id]+1 > layer[next] {
				layer[next] = layer[id] + 1
			}
			remaining[next]--
			if remaining[next] == 0 {
				queue = append(queue, next)
			}
		}
	}
	for _, n := range nodes {
		if _, ok := layer[n.ID]; !ok {
			layer[n.ID] = 0
		}
	}

	maxLayer := 0
	for _, l := range layer {
		if l > maxLayer {
			maxLayer = l
		}
	}
	byLayer := make([][]layoutNode, maxLayer+1)
	for _, n := range nodes {
		l := layer[n.ID]
		byLayer[l] = append(byLayer[l], n)
	}

	const crossGap = 60.0
	const layerGap = 120.0
	vertical := direction != "LR"

	mainPos := 0.0
	for l := 0; l <= maxLayer; l++ {
		items := byLayer[l]
		if len(items) == 0 {
			continue
		}
		mainExtent := 0.0
		totalCross := 0.0
		for i, n := range items {
			if vertical {
				if n.H > mainExtent {
					mainExtent = n.H
				}
				totalCross += n.W
			} else {
				if n.W > mainExtent {
					mainExtent = n.W
				}
				totalCross += n.H
			}
			if i > 0 {
				totalCross += crossGap
			}
		}
		cursor := -totalCross / 2
		for _, n := range items {
			if vertical {
				positions[n.ID] = [2]float64{cursor, mainPos}
				cursor += n.W + crossGap
			} else {
				positions[n.ID] = [2]float64{mainPos, cursor}
				cursor += n.H + crossGap
			}
		}
		mainPos += mainExtent + layerGap
	}
	return positions
}
