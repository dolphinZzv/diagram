package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
)

// Editable share: a per-diagram token that grants read *and write* access to a
// single diagram without the global DIAGRAM_TOKEN. Used by the editor when it
// is opened via ?edit=<token>.

func (s *Store) GetEditToken(diagramID string) (string, error) {
	var token string
	err := s.db.QueryRow(`SELECT edit_token FROM diagrams WHERE id = ?`, diagramID).Scan(&token)
	if errors.Is(err, sql.ErrNoRows) {
		return "", errNotFound
	}
	return token, err
}

func (s *Store) SetEditToken(diagramID, token string) error {
	res, err := s.db.Exec(`UPDATE diagrams SET edit_token = ? WHERE id = ?`, token, diagramID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errNotFound
	}
	return nil
}

// GetByEditToken returns the diagram (live draft data) for an edit token.
func (s *Store) GetByEditToken(token string) (Diagram, error) {
	var d Diagram
	var data string
	err := s.db.QueryRow(
		`SELECT id, name, description, data, created_at, updated_at
		 FROM diagrams WHERE edit_token = ? AND edit_token != ''`, token,
	).Scan(&d.ID, &d.Name, &d.Description, &data, &d.CreatedAt, &d.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return d, errNotFound
	}
	if err != nil {
		return d, err
	}
	d.Data = json.RawMessage(data)
	return d, nil
}

// ---------------- protected management handlers ----------------

func (a *API) GetEditShare(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	token, err := a.store.GetEditToken(id)
	if errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "diagram not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load edit share")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"enabled": token != "", "token": token})
}

func (a *API) EnableEditShare(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	if _, err := a.store.Get(id); errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "diagram not found")
		return
	} else if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load diagram")
		return
	}
	token := newShareToken()
	if err := a.store.SetEditToken(id, token); err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to enable edit share")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"enabled": true, "token": token})
}

func (a *API) DisableEditShare(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	if err := a.store.SetEditToken(id, ""); errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "diagram not found")
		return
	} else if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to disable edit share")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"enabled": false, "token": ""})
}

// ---------------- public handlers (no auth) ----------------

// PublicEditGet returns the live draft for an editable-share token.
func (a *API) PublicEditGet(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
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
	writeJSON(w, http.StatusOK, map[string]any{
		"id":          d.ID,
		"name":        d.Name,
		"description": d.Description,
		"data":        d.Data,
		"updatedAt":   d.UpdatedAt,
	})
}

// PublicEditPut saves the live draft for an editable-share token.
func (a *API) PublicEditPut(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	if token == "" {
		writeErr(w, http.StatusBadRequest, "missing token")
		return
	}
	req, err := decodeReq[diagramUpdateReq](r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	existing, err := a.store.GetByEditToken(token)
	if errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "edit link not found or disabled")
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
	if a.store.ShouldVersion(existing.ID, existing.Data) {
		_, _ = a.store.CreateVersion(DiagramVersion{
			DiagramID: existing.ID,
			Origin:    "auto",
			Data:      existing.Data,
		})
	}
	writeJSON(w, http.StatusOK, existing)
}
