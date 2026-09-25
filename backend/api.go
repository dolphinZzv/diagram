package main

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

type API struct {
	store *Store
}

type diagramListItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

type diagramCreateReq struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Data        json.RawMessage `json:"data"`
}

type diagramUpdateReq struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Data        json.RawMessage `json:"data"`
}

func (a *API) List(w http.ResponseWriter, r *http.Request) {
	items, err := a.store.List()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to list diagrams")
		return
	}
	out := make([]diagramListItem, 0, len(items))
	for _, d := range items {
		out = append(out, diagramListItem{
			ID:          d.ID,
			Name:        d.Name,
			Description: d.Description,
			CreatedAt:   d.CreatedAt,
			UpdatedAt:   d.UpdatedAt,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) Get(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	if id == "" {
		writeErr(w, http.StatusBadRequest, "missing id")
		return
	}
	d, err := a.store.Get(id)
	if errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "diagram not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load diagram")
		return
	}
	writeJSON(w, http.StatusOK, d)
}

func (a *API) Create(w http.ResponseWriter, r *http.Request) {
	req, err := decodeReq[diagramCreateReq](r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Name == "" {
		req.Name = "Untitled diagram"
	}
	if len(req.Data) == 0 || string(req.Data) == "null" {
		req.Data = json.RawMessage(`{"nodes":[],"edges":[]}`)
	}
	d := Diagram{
		ID:          newID(),
		Name:        req.Name,
		Description: req.Description,
		Data:        req.Data,
		CreatedAt:   nowISO(),
		UpdatedAt:   nowISO(),
	}
	if err := a.store.Create(d); err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to create diagram")
		return
	}
	// Initial revision.
	_, _ = a.store.CreateVersion(DiagramVersion{
		DiagramID: d.ID,
		Label:     "创建",
		Origin:    "create",
		Data:      d.Data,
	})
	writeJSON(w, http.StatusCreated, d)
}

func (a *API) Update(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	if id == "" {
		writeErr(w, http.StatusBadRequest, "missing id")
		return
	}
	req, err := decodeReq[diagramUpdateReq](r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	existing, err := a.store.Get(id)
	if errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "diagram not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load diagram")
		return
	}
	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.Description != "" {
		existing.Description = req.Description
	}
	if len(req.Data) > 0 && string(req.Data) != "null" {
		existing.Data = req.Data
	}
	existing.UpdatedAt = nowISO()
	if err := a.store.Update(existing); err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to save diagram")
		return
	}
	// Auto-snapshot only when the drawing data actually changed.
	if a.store.ShouldVersion(existing.ID, existing.Data) {
		_, _ = a.store.CreateVersion(DiagramVersion{
			DiagramID: existing.ID,
			Origin:    "auto",
			Data:      existing.Data,
		})
	}
	writeJSON(w, http.StatusOK, existing)
}

func (a *API) Delete(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	if id == "" {
		writeErr(w, http.StatusBadRequest, "missing id")
		return
	}
	if err := a.store.Delete(id); errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "diagram not found")
		return
	} else if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to delete diagram")
		return
	}
	_ = a.store.DeleteVersionsForDiagram(id)
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func decodeReq[T any](r *http.Request) (T, error) {
	var v T
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodySize))
	if err != nil {
		return v, err
	}
	if len(body) == 0 {
		return v, nil
	}
	err = json.Unmarshal(body, &v)
	return v, err
}
