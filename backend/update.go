package main

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const (
	repoOwner = "dolphinZzv"
	repoName  = "diagram"
)

type ghAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

type ghRelease struct {
	TagName string    `json:"tag_name"`
	Name    string    `json:"name"`
	Assets  []ghAsset `json:"assets"`
}

func httpClient() *http.Client {
	return &http.Client{Timeout: 120 * time.Second}
}

func fetchLatestRelease() (ghRelease, error) {
	var rel ghRelease
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", repoOwner, repoName)
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "diagram-updater")
	res, err := httpClient().Do(req)
	if err != nil {
		return rel, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return rel, fmt.Errorf("github api: %s", res.Status)
	}
	if err := json.NewDecoder(res.Body).Decode(&rel); err != nil {
		return rel, err
	}
	return rel, nil
}

func assetName() (string, error) {
	goos := runtime.GOOS
	goarch := runtime.GOARCH
	switch goos {
	case "linux", "darwin":
		return fmt.Sprintf("diagram_%s_%s.tar.gz", goos, goarch), nil
	case "windows":
		return fmt.Sprintf("diagram_%s_%s.zip", goos, goarch), nil
	default:
		return "", fmt.Errorf("unsupported OS: %s", goos)
	}
}

func findAsset(rel ghRelease, name string) (ghAsset, bool) {
	for _, a := range rel.Assets {
		if a.Name == name {
			return a, true
		}
	}
	return ghAsset{}, false
}

func selfUpdate() error {
	fmt.Printf("diagram %s — checking for updates…\n", version)
	rel, err := fetchLatestRelease()
	if err != nil {
		return fmt.Errorf("check update: %w", err)
	}
	latest := strings.TrimPrefix(rel.TagName, "v")
	current := strings.TrimPrefix(version, "v")
	if version != "dev" && latest == current {
		fmt.Printf("already up to date (%s)\n", version)
		return nil
	}

	name, err := assetName()
	if err != nil {
		return err
	}
	asset, ok := findAsset(rel, name)
	if !ok {
		return fmt.Errorf("no asset %q in release %s", name, rel.TagName)
	}

	exe, err := os.Executable()
	if err != nil {
		return err
	}
	exe, _ = filepath.EvalSymlinks(exe)

	fmt.Printf("downloading %s (%s → %s)…\n", asset.Name, current, latest)
	res, err := httpClient().Get(asset.BrowserDownloadURL)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("download: %s", res.Status)
	}

	tmpDir, err := os.MkdirTemp("", "diagram-update")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	binName := "diagram"
	if runtime.GOOS == "windows" {
		binName = "diagram.exe"
	}
	binPath := filepath.Join(tmpDir, binName)

	if strings.HasSuffix(asset.Name, ".zip") {
		archive := filepath.Join(tmpDir, "pkg.zip")
		if err := saveBody(res.Body, archive); err != nil {
			return err
		}
		if err := extractZip(archive, tmpDir, binName); err != nil {
			return err
		}
	} else {
		if err := extractTarGz(res.Body, tmpDir, binName); err != nil {
			return err
		}
	}

	if err := os.Chmod(binPath, 0o755); err != nil {
		return err
	}
	if err := replaceExecutable(exe, binPath); err != nil {
		return err
	}
	fmt.Printf("updated to %s ✓\n", rel.TagName)
	return nil
}

func saveBody(r io.Reader, path string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, r)
	return err
}

func extractTarGz(r io.Reader, dir, want string) error {
	gz, err := gzip.NewReader(r)
	if err != nil {
		return err
	}
	defer gz.Close()
	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return err
		}
		if filepath.Base(hdr.Name) != want {
			continue
		}
		out, err := os.OpenFile(filepath.Join(dir, want), os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755)
		if err != nil {
			return err
		}
		defer out.Close()
		_, err = io.Copy(out, tr)
		return err
	}
	return fmt.Errorf("%s not found in archive", want)
}

func extractZip(archive, dir, want string) error {
	zr, err := zip.OpenReader(archive)
	if err != nil {
		return err
	}
	defer zr.Close()
	for _, f := range zr.File {
		if filepath.Base(f.Name) != want {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		defer rc.Close()
		out, err := os.OpenFile(filepath.Join(dir, want), os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755)
		if err != nil {
			return err
		}
		defer out.Close()
		_, err = io.Copy(out, rc)
		return err
	}
	return fmt.Errorf("%s not found in archive", want)
}

func replaceExecutable(target, source string) error {
	// On Unix we can atomically replace a running binary via rename.
	backup := target + ".old"
	_ = os.Remove(backup)
	if runtime.GOOS == "windows" {
		_ = os.Rename(target, backup)
	}
	if err := os.Rename(source, target); err != nil {
		// Cross-device fallback: copy.
		if err2 := copyFile(source, target); err2 != nil {
			return err
		}
	}
	_ = os.Remove(backup)
	return nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

// checkUpdateResult is returned by the /api/update-check endpoint so the UI
// can surface available updates.
type checkUpdateResult struct {
	Current         string `json:"current"`
	Latest          string `json:"latest"`
	UpdateAvailable bool   `json:"updateAvailable"`
	URL             string `json:"url"`
	Error           string `json:"error,omitempty"`
}

func checkUpdate() checkUpdateResult {
	res := checkUpdateResult{Current: version}
	res.URL = fmt.Sprintf("https://github.com/%s/%s/releases/latest", repoOwner, repoName)
	rel, err := fetchLatestRelease()
	if err != nil {
		res.Error = err.Error()
		return res
	}
	res.Latest = strings.TrimPrefix(rel.TagName, "v")
	cur := strings.TrimPrefix(version, "v")
	res.UpdateAvailable = version == "dev" || res.Latest != cur
	return res
}
