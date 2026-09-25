package main

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"testing"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	s, err := NewStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("NewStore: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return s
}

func sampleDiagram(name string) Diagram {
	return Diagram{
		ID:          newID(),
		Name:        name,
		Description: "desc",
		Data:        json.RawMessage(`{"nodes":[{"id":"n1"}],"edges":[]}`),
		CreatedAt:   nowISO(),
		UpdatedAt:   nowISO(),
	}
}

func TestStoreCreateGet(t *testing.T) {
	s := newTestStore(t)
	d := sampleDiagram("架构图")

	if err := s.Create(d); err != nil {
		t.Fatalf("Create: %v", err)
	}

	got, err := s.Get(d.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Name != "架构图" {
		t.Errorf("Name = %q, want 架构图", got.Name)
	}
	if string(got.Data) != string(d.Data) {
		t.Errorf("Data = %s, want %s", got.Data, d.Data)
	}
	if got.CreatedAt == "" || got.UpdatedAt == "" {
		t.Errorf("timestamps should be set, got %q / %q", got.CreatedAt, got.UpdatedAt)
	}
}

func TestStoreGetNotFound(t *testing.T) {
	s := newTestStore(t)
	_, err := s.Get("does-not-exist")
	if !errors.Is(err, errNotFound) {
		t.Fatalf("Get(missing) err = %v, want errNotFound", err)
	}
}

func TestStoreUpdate(t *testing.T) {
	s := newTestStore(t)
	d := sampleDiagram("before")
	if err := s.Create(d); err != nil {
		t.Fatalf("Create: %v", err)
	}

	d.Name = "after"
	d.Data = json.RawMessage(`{"nodes":[],"edges":[{"id":"e1"}]}`)
	if err := s.Update(d); err != nil {
		t.Fatalf("Update: %v", err)
	}

	got, err := s.Get(d.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Name != "after" {
		t.Errorf("Name = %q, want after", got.Name)
	}
	if string(got.Data) != `{"nodes":[],"edges":[{"id":"e1"}]}` {
		t.Errorf("Data = %s", got.Data)
	}
}

func TestStoreUpdateNotFound(t *testing.T) {
	s := newTestStore(t)
	d := sampleDiagram("missing")
	if err := s.Update(d); !errors.Is(err, errNotFound) {
		t.Fatalf("Update(missing) err = %v, want errNotFound", err)
	}
}

func TestStoreDelete(t *testing.T) {
	s := newTestStore(t)
	d := sampleDiagram("to-delete")
	if err := s.Create(d); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if err := s.Delete(d.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := s.Get(d.ID); !errors.Is(err, errNotFound) {
		t.Fatalf("Get after delete err = %v, want errNotFound", err)
	}
	if err := s.Delete(d.ID); !errors.Is(err, errNotFound) {
		t.Fatalf("second Delete err = %v, want errNotFound", err)
	}
}

func TestStoreListOrder(t *testing.T) {
	s := newTestStore(t)
	a := sampleDiagram("a")
	b := sampleDiagram("b")
	if err := s.Create(a); err != nil {
		t.Fatalf("Create a: %v", err)
	}
	if err := s.Create(b); err != nil {
		t.Fatalf("Create b: %v", err)
	}
	// Update a so it becomes most recently updated.
	a.UpdatedAt = nowISO()
	a.Name = "a2"
	if err := s.Update(a); err != nil {
		t.Fatalf("Update a: %v", err)
	}

	items, err := s.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("len = %d, want 2", len(items))
	}
	if items[0].Name != "a2" {
		t.Errorf("first item = %q, want a2 (most recently updated)", items[0].Name)
	}
}
