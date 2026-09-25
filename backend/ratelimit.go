package main

import (
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// defaultRateLimit is the number of API requests allowed per minute per client
// IP when DIAGRAM_RATE_LIMIT is not set. Set DIAGRAM_RATE_LIMIT=0 to disable.
const defaultRateLimit = 600

type rateWindow struct {
	start time.Time
	count int
}

// rateLimiter is a small fixed-window limiter keyed by client IP. It only
// guards /api/ traffic; static assets are never throttled.
type rateLimiter struct {
	mu      sync.Mutex
	windows map[string]*rateWindow
	limit   int
	window  time.Duration
	now     func() time.Time
}

func newRateLimiter(limit int) *rateLimiter {
	return &rateLimiter{
		windows: make(map[string]*rateWindow),
		limit:   limit,
		window:  time.Minute,
		now:     time.Now,
	}
}

func (rl *rateLimiter) allow(key string) bool {
	if rl.limit <= 0 {
		return true
	}
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := rl.now()
	w, ok := rl.windows[key]
	if !ok || now.Sub(w.start) >= rl.window {
		rl.windows[key] = &rateWindow{start: now, count: 1}
		if len(rl.windows) > 10000 {
			for k, v := range rl.windows {
				if now.Sub(v.start) >= rl.window {
					delete(rl.windows, k)
				}
			}
		}
		return true
	}
	if w.count >= rl.limit {
		return false
	}
	w.count++
	return true
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.IndexByte(xff, ','); i > 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}

func rateLimitMiddleware(rl *rateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/") && !rl.allow(clientIP(r)) {
				w.Header().Set("Retry-After", "60")
				writeErr(w, http.StatusTooManyRequests, "rate limit exceeded, retry later")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// rateLimitFromEnv reads DIAGRAM_RATE_LIMIT (requests per minute).
func rateLimitFromEnv() int {
	v := os.Getenv("DIAGRAM_RATE_LIMIT")
	if v == "" {
		return defaultRateLimit
	}
	n, err := strconv.Atoi(strings.TrimSpace(v))
	if err != nil || n < 0 {
		return defaultRateLimit
	}
	return n
}
