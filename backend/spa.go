package main

import (
	"embed"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// dist is populated by the build pipeline: the frontend build output is
// copied into backend/dist before `go build`. During local development the
// directory may not exist and we fall back to disk serving.
//
//go:embed all:dist
var distFS embed.FS

func spaHandler() http.Handler {
	var fileSystem http.FileSystem

	sub, err := fs.Sub(distFS, "dist")
	if err == nil {
		if _, e := fs.Stat(sub, "index.html"); e == nil {
			fileSystem = http.FS(sub)
		}
	}
	if fileSystem == nil {
		// Dev fallback: serve ../frontend/dist from disk if present.
		if _, err := os.Stat("../frontend/dist/index.html"); err == nil {
			fileSystem = http.Dir("../frontend/dist")
		}
	}
	if fileSystem == nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write([]byte("<h1>diagram</h1><p>Frontend not built. Run <code>make web</code> and rebuild, or use the dev server.</p>"))
		})
	}

	fileServer := http.FileServer(fileSystem)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.HasPrefix(path, "/api/") {
			http.NotFound(w, r)
			return
		}
		// Try to serve the exact file first.
		if path != "/" {
			if f, err := fileSystem.Open(strings.TrimPrefix(path, "/")); err == nil {
				if st, e := f.Stat(); e == nil && !st.IsDir() {
					f.Close()
					if ct := mime.TypeByExtension(filepath.Ext(path)); ct != "" {
						w.Header().Set("Content-Type", ct)
					}
					fileServer.ServeHTTP(w, r)
					return
				}
				f.Close()
			}
		}
		// SPA fallback: serve index.html for client-side routes.
		idx, err := fileSystem.Open("index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer idx.Close()
		st, _ := idx.Stat()
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		http.ServeContent(w, r, "index.html", st.ModTime(), idx.(io.ReadSeeker))
	})
}
