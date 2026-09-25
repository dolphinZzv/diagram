package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const maxBodySize = 50 << 20 // 50 MB

var (
	version = "dev"
	commit  = "none"
	date    = "unknown"
)

func newID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return hex.EncodeToString([]byte(time.Now().Format("20060102150405.000000000")))
	}
	return hex.EncodeToString(b)
}

func nowISO() string { return time.Now().UTC().Format(time.RFC3339) }

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("write json: %v", err)
	}
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// corsMiddleware is only relevant during local development where the Vite
// dev server runs on a different port than the API.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "version", "--version", "-v":
			fmt.Printf("diagram %s (commit %s, built %s)\n", version, commit, date)
			return
		case "update", "upgrade":
			if err := selfUpdate(); err != nil {
				log.Fatalf("update failed: %v", err)
			}
			return
		case "help", "--help", "-h":
			printHelp()
			return
		}
	}

	fs := flag.NewFlagSet("diagram", flag.ExitOnError)
	addr := fs.String("addr", envOr("DIAGRAM_ADDR", "0.0.0.0:8080"), "listen address (e.g. 0.0.0.0:8080)")
	dbPath := fs.String("db", envOr("DIAGRAM_DB", defaultDBPath()), "sqlite database path")
	showVersion := fs.Bool("version", false, "print version")
	_ = fs.Parse(os.Args[1:])
	if *showVersion {
		fmt.Printf("diagram %s\n", version)
		return
	}

	store, err := NewStore(*dbPath)
	if err != nil {
		log.Fatalf("open store: %v", err)
	}
	defer store.Close()

	mux := http.NewServeMux()

	// API
	api := &API{store: store}
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/version", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"version": version, "commit": commit, "date": date})
	})
	mux.HandleFunc("GET /api/update-check", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, checkUpdate())
	})
	mux.HandleFunc("GET /api/diagrams", api.List)
	mux.HandleFunc("POST /api/diagrams", api.Create)
	mux.HandleFunc("GET /api/diagrams/{id}", api.Get)
	mux.HandleFunc("PUT /api/diagrams/{id}", api.Update)
	mux.HandleFunc("DELETE /api/diagrams/{id}", api.Delete)

	// Frontend (embedded at build time; falls back to disk during dev).
	mux.Handle("/", spaHandler())

	handler := loggingMiddleware(corsMiddleware(mux))

	log.Printf("diagram server %s listening on %s (db: %s)", version, *addr, *dbPath)
	log.Printf("open: http://localhost:%s", portOf(*addr))
	srv := &http.Server{
		Addr:              *addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("listen: %v", err)
	}
}

func printHelp() {
	fmt.Print(`diagram — 流程图 / 架构图设计器

用法:
  diagram                     启动服务 (默认监听 0.0.0.0:8080)
  diagram -addr 0.0.0.0:9000  指定监听地址
  diagram -addr 127.0.0.1:8080 仅本机访问
  diagram -db /path            指定数据库文件
  diagram update               检查并更新到最新版本
  diagram version              查看当前版本
  diagram help                 查看帮助

环境变量:
  DIAGRAM_ADDR     监听地址 (默认 0.0.0.0:8080)
  DIAGRAM_DB       SQLite 数据库路径 (默认 ~/.diagram/diagram.db)
  DIAGRAM_DATA_DIR 数据目录
`)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// portOf returns the port portion of a listen address like "0.0.0.0:8080".
func portOf(addr string) string {
	if i := strings.LastIndex(addr, ":"); i >= 0 {
		return addr[i+1:]
	}
	return addr
}

func defaultDBPath() string {
	if dir := os.Getenv("DIAGRAM_DATA_DIR"); dir != "" {
		return filepath.Join(dir, "diagram.db")
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "diagram.db"
	}
	return filepath.Join(home, ".diagram", "diagram.db")
}

// trimmedPath extracts a clean {id} path value.
func trimmedPath(r *http.Request) string {
	return strings.TrimSpace(r.PathValue("id"))
}
