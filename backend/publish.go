package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
)

// PublishState describes the draft/publish status of a diagram.
type PublishState struct {
	Published   bool   `json:"published"`
	PublishedAt string `json:"publishedAt"`
	// Dirty is true when the draft differs from the published snapshot.
	Dirty bool `json:"dirty"`
}

// Publish snapshots the current draft as the published version.
func (s *Store) Publish(id string) (string, error) {
	d, err := s.Get(id)
	if err != nil {
		return "", err
	}
	ts := nowISO()
	res, err := s.db.Exec(
		`UPDATE diagrams SET published_data = ?, published_at = ? WHERE id = ?`,
		string(d.Data), ts, id,
	)
	if err != nil {
		return "", err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return "", errNotFound
	}
	return ts, nil
}

func (s *Store) Unpublish(id string) error {
	res, err := s.db.Exec(`UPDATE diagrams SET published_data = '', published_at = '' WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errNotFound
	}
	return nil
}

func (s *Store) GetPublishState(id string) (PublishState, error) {
	var data, published, publishedAt string
	err := s.db.QueryRow(
		`SELECT data, published_data, published_at FROM diagrams WHERE id = ?`, id,
	).Scan(&data, &published, &publishedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return PublishState{}, errNotFound
	}
	if err != nil {
		return PublishState{}, err
	}
	return PublishState{
		Published:   published != "",
		PublishedAt: publishedAt,
		Dirty:       published != data,
	}, nil
}

// GetPublishedByShareToken returns the published snapshot when available,
// otherwise the current data (backward compatible). The second return value is
// the effective timestamp (published_at, or updated_at as a fallback).
func (s *Store) GetPublishedByShareToken(token string) (Diagram, string, error) {
	var d Diagram
	var data, published, publishedAt string
	err := s.db.QueryRow(
		`SELECT id, name, description, data, published_data, published_at, updated_at
		 FROM diagrams WHERE share_token = ? AND share_token != ''`, token,
	).Scan(&d.ID, &d.Name, &d.Description, &data, &published, &publishedAt, &d.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return d, "", errNotFound
	}
	if err != nil {
		return d, "", err
	}
	effective := data
	ts := d.UpdatedAt
	if published != "" {
		effective = published
		ts = publishedAt
	}
	d.Data = json.RawMessage(effective)
	return d, ts, nil
}

// ---------------- HTTP handlers ----------------

func (a *API) GetPublish(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	state, err := a.store.GetPublishState(id)
	if errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "diagram not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load publish state")
		return
	}
	writeJSON(w, http.StatusOK, state)
}

func (a *API) Publish(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	ts, err := a.store.Publish(id)
	if errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "diagram not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to publish")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"published": true, "publishedAt": ts})
}

func (a *API) Unpublish(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	if err := a.store.Unpublish(id); errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "diagram not found")
		return
	} else if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to unpublish")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"published": false})
}
