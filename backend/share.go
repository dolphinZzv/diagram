package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
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

// SaveShareAsset stores a rendered image (svg or png) for a diagram.
func (s *Store) SaveShareAsset(diagramID, format string, data []byte) error {
	_, err := s.db.Exec(
		`INSERT INTO share_assets (diagram_id, format, data, updated_at) VALUES (?, ?, ?, ?)
		 ON CONFLICT(diagram_id, format) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
		diagramID, format, data, nowISO(),
	)
	return err
}

func (s *Store) GetShareAsset(diagramID, format string) ([]byte, error) {
	var data []byte
	err := s.db.QueryRow(
		`SELECT data FROM share_assets WHERE diagram_id = ? AND format = ?`, diagramID, format,
	).Scan(&data)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errNotFound
	}
	return data, err
}

func (s *Store) DeleteShareAssets(diagramID string) error {
	_, err := s.db.Exec(`DELETE FROM share_assets WHERE diagram_id = ?`, diagramID)
	return err
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

// UploadShareImage stores a client-rendered image (svg/png) for a diagram.
func (a *API) UploadShareImage(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	format := strings.ToLower(r.URL.Query().Get("format"))
	if format != "svg" && format != "png" {
		writeErr(w, http.StatusBadRequest, "format must be svg or png")
		return
	}
	if _, err := a.store.Get(id); errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "diagram not found")
		return
	} else if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load diagram")
		return
	}
	data, err := io.ReadAll(io.LimitReader(r.Body, 20<<20))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "failed to read image")
		return
	}
	if len(data) == 0 {
		writeErr(w, http.StatusBadRequest, "empty image")
		return
	}
	if err := a.store.SaveShareAsset(id, format, data); err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to store image")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"format": format, "bytes": len(data)})
}

// PublicShare returns a read-only snapshot for a share token. It is mounted on
// the public mux and does not require authentication. Requesting
// /api/share/<token>.svg or .png returns the pre-rendered image directly.
func (a *API) PublicShare(w http.ResponseWriter, r *http.Request) {
	raw := r.PathValue("token")
	token := raw
	format := ""
	switch {
	case strings.HasSuffix(raw, ".svg"):
		format = "svg"
		token = strings.TrimSuffix(raw, ".svg")
	case strings.HasSuffix(raw, ".png"):
		format = "png"
		token = strings.TrimSuffix(raw, ".png")
	}
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

	if format != "" {
		data, err := a.store.GetShareAsset(d.ID, format)
		if errors.Is(err, errNotFound) {
			writeErr(w, http.StatusNotFound, "image not generated yet")
			return
		}
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "failed to load image")
			return
		}
		ct := "image/svg+xml"
		if format == "png" {
			ct = "image/png"
		}
		w.Header().Set("Content-Type", ct)
		w.Header().Set("Cache-Control", "public, max-age=60")
		w.Header().Set("Content-Disposition", "inline; filename=diagram."+format)
		_, _ = w.Write(data)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"name":        d.Name,
		"description": d.Description,
		"data":        d.Data,
		"updatedAt":   d.UpdatedAt,
	})
}
