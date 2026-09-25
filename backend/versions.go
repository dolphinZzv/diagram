package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
)

// maxVersionsPerDiagram caps how many revisions we keep per diagram.
const maxVersionsPerDiagram = 100

// DiagramVersion is a point-in-time snapshot of a diagram's data.
type DiagramVersion struct {
	ID        int64           `json:"id"`
	DiagramID string          `json:"diagramId"`
	Version   int             `json:"version"`
	Label     string          `json:"label"`
	Origin    string          `json:"origin"` // create | auto | manual | restore
	Hash      string          `json:"hash,omitempty"`
	Data      json.RawMessage `json:"data,omitempty"`
	NodeCount int             `json:"nodeCount"`
	EdgeCount int             `json:"edgeCount"`
	CreatedAt string          `json:"createdAt"`
}

func hashJSON(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func countNodesEdges(data []byte) (int, int) {
	var doc struct {
		Nodes []json.RawMessage `json:"nodes"`
		Edges []json.RawMessage `json:"edges"`
	}
	if err := json.Unmarshal(data, &doc); err != nil {
		return 0, 0
	}
	return len(doc.Nodes), len(doc.Edges)
}

func (s *Store) NextVersion(diagramID string) (int, error) {
	var max int
	err := s.db.QueryRow(
		`SELECT COALESCE(MAX(version), 0) FROM diagram_versions WHERE diagram_id = ?`, diagramID,
	).Scan(&max)
	return max + 1, err
}

// LatestVersionHash returns the hash and number of the newest version, or
// ("", 0, nil) when the diagram has no versions yet.
func (s *Store) LatestVersionHash(diagramID string) (string, int, error) {
	var hash string
	var version int
	err := s.db.QueryRow(
		`SELECT hash, version FROM diagram_versions WHERE diagram_id = ? ORDER BY version DESC LIMIT 1`, diagramID,
	).Scan(&hash, &version)
	if errors.Is(err, sql.ErrNoRows) {
		return "", 0, nil
	}
	return hash, version, err
}

// ShouldVersion reports whether data differs from the latest stored revision.
func (s *Store) ShouldVersion(diagramID string, data []byte) bool {
	hash, _, err := s.LatestVersionHash(diagramID)
	if err != nil {
		return true
	}
	if hash == "" {
		return true
	}
	return hash != hashJSON(data)
}

// CreateVersion stores a new revision, assigning the next version number.
func (s *Store) CreateVersion(v DiagramVersion) (DiagramVersion, error) {
	next, err := s.NextVersion(v.DiagramID)
	if err != nil {
		return v, err
	}
	v.Version = next
	v.Hash = hashJSON(v.Data)
	v.NodeCount, v.EdgeCount = countNodesEdges(v.Data)
	if v.CreatedAt == "" {
		v.CreatedAt = nowISO()
	}
	if v.Origin == "" {
		v.Origin = "auto"
	}
	res, err := s.db.Exec(
		`INSERT INTO diagram_versions (diagram_id, version, label, origin, hash, data, node_count, edge_count, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		v.DiagramID, v.Version, v.Label, v.Origin, v.Hash, string(v.Data), v.NodeCount, v.EdgeCount, v.CreatedAt,
	)
	if err != nil {
		return v, err
	}
	v.ID, _ = res.LastInsertId()
	if err := s.PruneVersions(v.DiagramID, maxVersionsPerDiagram); err != nil {
		return v, err
	}
	return v, nil
}

// ListVersions returns version metadata (without the data blob), newest first.
func (s *Store) ListVersions(diagramID string) ([]DiagramVersion, error) {
	rows, err := s.db.Query(
		`SELECT id, diagram_id, version, label, origin, hash, node_count, edge_count, created_at
		 FROM diagram_versions WHERE diagram_id = ? ORDER BY version DESC`, diagramID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []DiagramVersion{}
	for rows.Next() {
		var v DiagramVersion
		if err := rows.Scan(&v.ID, &v.DiagramID, &v.Version, &v.Label, &v.Origin, &v.Hash, &v.NodeCount, &v.EdgeCount, &v.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (s *Store) GetVersion(diagramID string, version int) (DiagramVersion, error) {
	var v DiagramVersion
	var data string
	err := s.db.QueryRow(
		`SELECT id, diagram_id, version, label, origin, hash, data, node_count, edge_count, created_at
		 FROM diagram_versions WHERE diagram_id = ? AND version = ?`, diagramID, version,
	).Scan(&v.ID, &v.DiagramID, &v.Version, &v.Label, &v.Origin, &v.Hash, &data, &v.NodeCount, &v.EdgeCount, &v.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return v, errNotFound
	}
	if err != nil {
		return v, err
	}
	v.Data = json.RawMessage(data)
	return v, nil
}

func (s *Store) DeleteVersion(diagramID string, version int) error {
	res, err := s.db.Exec(`DELETE FROM diagram_versions WHERE diagram_id = ? AND version = ?`, diagramID, version)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return errNotFound
	}
	return nil
}

func (s *Store) DeleteVersionsForDiagram(diagramID string) error {
	_, err := s.db.Exec(`DELETE FROM diagram_versions WHERE diagram_id = ?`, diagramID)
	return err
}

// PruneVersions keeps only the newest `keep` revisions for a diagram.
func (s *Store) PruneVersions(diagramID string, keep int) error {
	if keep <= 0 {
		return nil
	}
	_, err := s.db.Exec(
		`DELETE FROM diagram_versions
		 WHERE diagram_id = ? AND version NOT IN (
		   SELECT version FROM diagram_versions WHERE diagram_id = ? ORDER BY version DESC LIMIT ?
		 )`, diagramID, diagramID, keep,
	)
	return err
}

// ---------------- HTTP handlers ----------------

func (a *API) ListVersions(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	versions, err := a.store.ListVersions(id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to list versions")
		return
	}
	writeJSON(w, http.StatusOK, versions)
}

func (a *API) GetVersion(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	version, err := strconv.Atoi(r.PathValue("version"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid version")
		return
	}
	v, err := a.store.GetVersion(id, version)
	if errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "version not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load version")
		return
	}
	writeJSON(w, http.StatusOK, v)
}

func (a *API) CreateVersion(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	d, err := a.store.Get(id)
	if errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "diagram not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load diagram")
		return
	}
	req, _ := decodeReq[struct {
		Label string `json:"label"`
	}](r)
	v, err := a.store.CreateVersion(DiagramVersion{
		DiagramID: id,
		Label:     req.Label,
		Origin:    "manual",
		Data:      d.Data,
	})
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to create version")
		return
	}
	writeJSON(w, http.StatusCreated, v)
}

func (a *API) RestoreVersion(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	version, err := strconv.Atoi(r.PathValue("version"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid version")
		return
	}
	ver, err := a.store.GetVersion(id, version)
	if errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "version not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to load version")
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
	d.Data = ver.Data
	d.UpdatedAt = nowISO()
	if err := a.store.Update(d); err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to restore version")
		return
	}
	nv, _ := a.store.CreateVersion(DiagramVersion{
		DiagramID: id,
		Label:     fmt.Sprintf("恢复自 v%d", version),
		Origin:    "restore",
		Data:      ver.Data,
	})
	writeJSON(w, http.StatusOK, map[string]any{"diagram": d, "version": nv})
}

func (a *API) DeleteVersion(w http.ResponseWriter, r *http.Request) {
	id := trimmedPath(r)
	version, err := strconv.Atoi(r.PathValue("version"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid version")
		return
	}
	if err := a.store.DeleteVersion(id, version); errors.Is(err, errNotFound) {
		writeErr(w, http.StatusNotFound, "version not found")
		return
	} else if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to delete version")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
