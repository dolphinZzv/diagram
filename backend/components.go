package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
)

// Component is a reusable shape or shape-group stored server-side so it can be
// shared across users/clients.
type Component struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Category  string          `json:"category"`
	Kind      string          `json:"kind"`
	Data      json.RawMessage `json:"data"` // { nodes: [], edges: [] }
	CreatedAt string          `json:"createdAt"`
	UpdatedAt string          `json:"updatedAt"`
}

func (s *Store) ListComponents() ([]Component, error) {
	rows, err := s.db.Query(
		`SELECT id, name, category, kind, data, created_at, updated_at FROM components ORDER BY category, name`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Component{}
	for rows.Next() {
		var c Component
		var data string
		if err := rows.Scan(&c.ID, &c.Name, &c.Category, &c.Kind, &data, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		c.Data = json.RawMessage(data)
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) GetComponent(id string) (Component, error) {
	var c Component
	var data string
	err := s.db.QueryRow(
		`SELECT id, name, category, kind, data, created_at, updated_at FROM components WHERE id = ?`, id,
	).Scan(&c.ID, &c.Name, &c.Category, &c.Kind, &data, &c.CreatedAt, &c.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return c, errNotFound
	}
	if err != nil {
		return c, err
	}
	c.Data = json.RawMessage(data)
	return c, nil
}

// UpsertComponent inserts or updates a component (client-generated ids).
func (s *Store) UpsertComponent(c Component) (Component, error) {
	now := nowISO()
	if c.ID == "" {
		c.ID = newID()
	}
	if c.Kind == "" {
		c.Kind = "single"
	}
	if len(c.Data) == 0 || string(c.Data) == "null" {
		c.Data = json.RawMessage(`{"nodes":[],"edges":[]}`)
	}
	existing, err := s.GetComponent(c.ID)
	if errors.Is(err, errNotFound) {
		c.CreatedAt = now
		c.UpdatedAt = now
	} else if err != nil {
		return c, err
	} else {
		c.CreatedAt = existing.CreatedAt
		c.UpdatedAt = now
	}
	_, err = s.db.Exec(
		`INSERT INTO components (id, name, category, kind, data, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET name = excluded.name, category = excluded.category,
		   kind = excluded.kind, data = excluded.data, updated_at = excluded.updated_at`,
		c.ID, c.Name, c.Category, c.Kind, string(c.Data), c.CreatedAt, c.UpdatedAt,
	)
	return c, err
}

func (s *Store) DeleteComponent(id string) error {
	res, err := s.db.Exec(`DELETE FROM components WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errNotFound
	}
	return nil
}

// ---------------- HTTP handlers ----------------

func (a *API) ListComponents(w http.ResponseWriter, r *http.Request) {
	items, err := a.store.ListComponents()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to list components")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (a *API) UpsertComponent(w http.ResponseWriter, r *http.Request) {
	req, err := decodeReq[Component](r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Name == "" {
		req.Name = "Component"
	}
	out, err := a.store.UpsertComponent(req)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to save component")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) UpdateComponent(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	if id == "" {
		writeErr(w, http.StatusBadRequest, "missing id")
		return
	}
	req, err := decodeReq[Component](r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.ID = id
	out, err := a.store.UpsertComponent(req)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to save component")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) DeleteComponent(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	if err := a.store.DeleteComponent(id); errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "component not found")
		return
	} else if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to delete component")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
