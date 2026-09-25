package main

import (
	"crypto/subtle"
	"net/http"
	"os"
	"strings"
)

// authMiddleware protects a handler when the DIAGRAM_TOKEN environment
// variable is set. The token may be supplied either as an
// "Authorization: Bearer <token>" header or a "?token=<token>" query
// parameter (the latter is convenient for opening saved diagrams directly).
//
// When DIAGRAM_TOKEN is empty the middleware is a no-op, preserving the
// zero-config single-user experience.
func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := os.Getenv("DIAGRAM_TOKEN")
		if token == "" {
			next.ServeHTTP(w, r)
			return
		}
		// Preflight requests must not be authenticated.
		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}

		provided := ""
		if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
			provided = strings.TrimPrefix(h, "Bearer ")
		} else if t := r.URL.Query().Get("token"); t != "" {
			provided = t
		}

		if subtle.ConstantTimeCompare([]byte(provided), []byte(token)) != 1 {
			writeErr(w, http.StatusUnauthorized, "unauthorized: missing or invalid token")
			return
		}
		next.ServeHTTP(w, r)
	})
}
