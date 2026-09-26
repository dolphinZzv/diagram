package main

import (
	"regexp"
	"testing"
)

func TestNewUUID(t *testing.T) {
	re := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		id := newUUID()
		if !re.MatchString(id) {
			t.Fatalf("newUUID() = %q, want a v4 UUID", id)
		}
		if seen[id] {
			t.Fatalf("newUUID() returned a duplicate: %q", id)
		}
		seen[id] = true
	}
}
