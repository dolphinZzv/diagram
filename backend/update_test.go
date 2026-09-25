package main

import (
	"runtime"
	"strings"
	"testing"
)

func TestAssetNameForCurrentPlatform(t *testing.T) {
	name, err := assetName()
	if err != nil {
		// Only unsupported platforms may error; that's acceptable.
		t.Skipf("assetName not supported on %s/%s: %v", runtime.GOOS, runtime.GOARCH, err)
	}
	switch runtime.GOOS {
	case "windows":
		if !strings.HasSuffix(name, ".zip") {
			t.Errorf("windows asset = %q, want .zip", name)
		}
	default:
		if !strings.HasSuffix(name, ".tar.gz") {
			t.Errorf("unix asset = %q, want .tar.gz", name)
		}
	}
	if !strings.Contains(name, runtime.GOOS) || !strings.Contains(name, runtime.GOARCH) {
		t.Errorf("asset %q should contain os/arch", name)
	}
}

func TestFindAsset(t *testing.T) {
	rel := ghRelease{
		TagName: "v1.2.3",
		Assets: []ghAsset{
			{Name: "diagram_linux_amd64.tar.gz", BrowserDownloadURL: "https://example.com/a"},
			{Name: "checksums.txt", BrowserDownloadURL: "https://example.com/b"},
		},
	}
	a, ok := findAsset(rel, "diagram_linux_amd64.tar.gz")
	if !ok {
		t.Fatalf("expected to find asset")
	}
	if a.BrowserDownloadURL != "https://example.com/a" {
		t.Errorf("url = %q", a.BrowserDownloadURL)
	}
	if _, ok := findAsset(rel, "missing.tar.gz"); ok {
		t.Errorf("did not expect to find missing asset")
	}
}

func TestCheckUpdateResultShape(t *testing.T) {
	// checkUpdate hits the network; we only assert the struct is well formed
	// when it fails offline (which is the common CI-less case).
	res := checkUpdate()
	if res.Current == "" {
		t.Errorf("Current should always be populated")
	}
	if res.URL == "" || !strings.Contains(res.URL, repoOwner) {
		t.Errorf("URL = %q, want it to reference %s", res.URL, repoOwner)
	}
}
