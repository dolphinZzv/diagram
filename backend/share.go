package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
)

func newShareToken() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return newID() + newID()
	}
	return hex.EncodeToString(b)
}

func (s *Store) GetShareToken(diagramID string) (string, error) {
	var token string
	err := s.db.QueryRow(`SELECT share_token FROM diagrams WHERE id = ?`, diagramID).Scan(&token)
	if errors.Is(err, sql.ErrNoRows) {
		return "", errNotFound
	}
	return token, err
}

func (s *Store) SetShareToken(diagramID, token string) error {
	res, err := s.db.Exec(`UPDATE diagrams SET share_token = ? WHERE id = ?`, token, diagramID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return errNotFound
	}
	return nil
}

func (s *Store) GetByShareToken(token string) (Diagram, error) {
	var d Diagram
	var data string
	err := s.db.QueryRow(
		`SELECT id, name, description, data, created_at, updated_at
		 FROM diagrams WHERE share_token = ? AND share_token != ''`, token,
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

// ---------------- HTTP handlers ----------------

func (a *API) GetShare(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	token, err := a.store.GetShareToken(id)
	if errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "diagram not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load share")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"enabled": token != "", "token": token})
}

func (a *API) EnableShare(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	if _, err := a.store.Get(id); errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "diagram not found")
		return
	} else if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load diagram")
		return
	}
	token := newShareToken()
	if err := a.store.SetShareToken(id, token); err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to enable share")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"enabled": true, "token": token})
}

func (a *API) DisableShare(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	if err := a.store.SetShareToken(id, ""); errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "diagram not found")
		return
	} else if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to disable share")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"enabled": false, "token": ""})
}

// PublicShare returns a read-only snapshot for a share token. It is mounted on
// the public mux and does not require authentication.
func (a *API) PublicShare(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	if token == "" {
		writeErr(w, http.StatusBadRequest, "missing token")
		return
	}
	d, err := a.store.GetByShareToken(token)
	if errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "share not found or disabled")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load share")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"name":        d.Name,
		"description": d.Description,
		"data":        d.Data,
		"updatedAt":   d.UpdatedAt,
	})
}
