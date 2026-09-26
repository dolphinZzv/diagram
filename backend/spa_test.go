package main

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestIsStaticAsset(t *testing.T) {
	cases := map[string]bool{
		"/assets/index-abc123.js":  true,
		"/assets/index-abc123.css": true,
		"/favicon.svg":             true,
		"/icon.svg":                true,
		"/manifest.webmanifest":    true,
		"/sw.js":                   true,
		"/missing.js":              true,
		"/nested/file.png":         true,
		"/":                        false,
		"/share":                   false,
		"/some/spa/route":          false,
		"/diagram/abc":             false,
	}
	for path, want := range cases {
		if got := isStaticAsset(path); got != want {
			t.Errorf("isStaticAsset(%q) = %v, want %v", path, got, want)
		}
	}
}

func TestSetCacheControl(t *testing.T) {
	asset := httptest.NewRecorder()
	setCacheControl(asset, "/assets/index-abc.js")
	if cc := asset.Header().Get("Cache-Control"); !strings.Contains(cc, "immutable") {
		t.Errorf("asset Cache-Control = %q, want immutable", cc)
	}

	sw := httptest.NewRecorder()
	setCacheControl(sw, "/sw.js")
	if cc := sw.Header().Get("Cache-Control"); !strings.Contains(cc, "no-store") {
		t.Errorf("sw.js Cache-Control = %q, want no-store", cc)
	}
}
