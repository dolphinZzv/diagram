package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var errNotFound = errors.New("not found")

// Diagram is a single saved document. Data holds the editor payload in the
// same JSON shape the editor imports/exports (nodes/edges/viewport).
type Diagram struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Data        json.RawMessage `json:"data"`
	CreatedAt   string          `json:"createdAt"`
	UpdatedAt   string          `json:"updatedAt"`
}

type Store struct {
	db *sql.DB
}

func NewStore(path string) (*Store, error) {
	if dir := filepath.Dir(path); dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, err
		}
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1) // sqlite: serialize writes, avoid locks

	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS diagrams (
			id          TEXT PRIMARY KEY,
			name        TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			data        TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
			share_token TEXT NOT NULL DEFAULT '',
			created_at  TEXT NOT NULL,
			updated_at  TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_diagrams_updated ON diagrams(updated_at DESC);

		CREATE TABLE IF NOT EXISTS diagram_versions (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			diagram_id  TEXT NOT NULL,
			version     INTEGER NOT NULL,
			label       TEXT NOT NULL DEFAULT '',
			origin      TEXT NOT NULL DEFAULT 'auto',
			hash        TEXT NOT NULL DEFAULT '',
			data        TEXT NOT NULL,
			node_count  INTEGER NOT NULL DEFAULT 0,
			edge_count  INTEGER NOT NULL DEFAULT 0,
			created_at  TEXT NOT NULL,
			UNIQUE(diagram_id, version)
		);
		CREATE INDEX IF NOT EXISTS idx_versions_diagram ON diagram_versions(diagram_id, version DESC);

		CREATE TABLE IF NOT EXISTS share_assets (
			diagram_id TEXT NOT NULL,
			format     TEXT NOT NULL,
			data       BLOB NOT NULL,
			updated_at TEXT NOT NULL,
			PRIMARY KEY (diagram_id, format)
		);
	`); err != nil {
		return nil, err
	}
	// Migrate databases created before share support was added.
	if err := ensureColumn(db, "diagrams", "share_token", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return nil, err
	}
	// The share index must be created *after* the column exists.
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_diagrams_share ON diagrams(share_token);`); err != nil {
		return nil, err
	}
	return &Store{db: db}, nil
}

// ensureColumn adds a column when it does not already exist (SQLite has no
// "ADD COLUMN IF NOT EXISTS").
func ensureColumn(db *sql.DB, table, column, ddl string) error {
	rows, err := db.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var (
			cid     int
			name    string
			ctype   string
			notnull int
			dflt    sql.NullString
			pk      int
		)
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return err
		}
		if name == column {
			return nil
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	_, err = db.Exec(`ALTER TABLE ` + table + ` ADD COLUMN ` + column + ` ` + ddl)
	return err
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) List() ([]Diagram, error) {
	rows, err := s.db.Query(`SELECT id, name, description, data, created_at, updated_at FROM diagrams ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Diagram{}
	for rows.Next() {
		var d Diagram
		var data string
		if err := rows.Scan(&d.ID, &d.Name, &d.Description, &data, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		d.Data = json.RawMessage(data)
		out = append(out, d)
	}
	return out, rows.Err()
}

func (s *Store) Get(id string) (Diagram, error) {
	var d Diagram
	var data string
	err := s.db.QueryRow(`SELECT id, name, description, data, created_at, updated_at FROM diagrams WHERE id = ?`, id).
		Scan(&d.ID, &d.Name, &d.Description, &data, &d.CreatedAt, &d.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return d, errNotFound
	}
	if err != nil {
		return d, err
	}
	d.Data = json.RawMessage(data)
	return d, nil
}

func (s *Store) Create(d Diagram) error {
	_, err := s.db.Exec(
		`INSERT INTO diagrams (id, name, description, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		d.ID, d.Name, d.Description, string(d.Data), d.CreatedAt, d.UpdatedAt,
	)
	return err
}

func (s *Store) Update(d Diagram) error {
	res, err := s.db.Exec(
		`UPDATE diagrams SET name = ?, description = ?, data = ?, updated_at = ? WHERE id = ?`,
		d.Name, d.Description, string(d.Data), d.UpdatedAt, d.ID,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return errNotFound
	}
	return nil
}

func (s *Store) Delete(id string) error {
	res, err := s.db.Exec(`DELETE FROM diagrams WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return errNotFound
	}
	return nil
}
