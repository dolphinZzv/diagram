package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiterWindow(t *testing.T) {
	rl := newRateLimiter(2)
	now := time.Now()
	rl.now = func() time.Time { return now }

	if !rl.allow("1.2.3.4") || !rl.allow("1.2.3.4") {
		t.Fatalf("first two requests should be allowed")
	}
	if rl.allow("1.2.3.4") {
		t.Fatalf("third request should be blocked")
	}
	// A different IP has its own budget.
	if !rl.allow("5.6.7.8") {
		t.Fatalf("different IP should be allowed")
	}
	// After the window elapses the budget resets.
	now = now.Add(time.Minute)
	if !rl.allow("1.2.3.4") {
		t.Fatalf("request after window should be allowed")
	}
}

func TestRateLimiterDisabled(t *testing.T) {
	rl := newRateLimiter(0)
	for i := 0; i < 100; i++ {
		if !rl.allow("1.2.3.4") {
			t.Fatalf("limit 0 should disable throttling")
		}
	}
}

func TestRateLimitMiddleware(t *testing.T) {
	t.Setenv("DIAGRAM_RATE_LIMIT", "2")
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	codes := make([]int, 0, 3)
	for i := 0; i < 3; i++ {
		res, err := srv.Client().Get(srv.URL + "/api/health")
		if err != nil {
			t.Fatalf("request %d: %v", i, err)
		}
		res.Body.Close()
		codes = append(codes, res.StatusCode)
	}
	if codes[0] != http.StatusOK || codes[1] != http.StatusOK {
		t.Fatalf("first two should be 200, got %v", codes)
	}
	if codes[2] != http.StatusTooManyRequests {
		t.Fatalf("third should be 429, got %v", codes)
	}
}

func TestRateLimitDoesNotThrottleStatic(t *testing.T) {
	t.Setenv("DIAGRAM_RATE_LIMIT", "1")
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	// /api/ consumes the single slot.
	res, _ := srv.Client().Get(srv.URL + "/api/health")
	res.Body.Close()
	res, _ = srv.Client().Get(srv.URL + "/api/health")
	if res.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("api should be limited, got %d", res.StatusCode)
	}
	// Static index must still be served.
	res, err := srv.Client().Get(srv.URL + "/")
	if err != nil {
		t.Fatalf("static request: %v", err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("static should not be limited, got %d", res.StatusCode)
	}
}

func TestCORSDefaultIsSameOrigin(t *testing.T) {
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	res, _ := doJSON(t, srv, http.MethodGet, "/api/health", "", nil)
	if got := res.Header.Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("expected no CORS header by default, got %q", got)
	}
}

func TestCORSConfigured(t *testing.T) {
	t.Setenv("DIAGRAM_ALLOW_ORIGIN", "https://example.com")
	srv := httptest.NewServer(newRouter(newTestStore(t)))
	defer srv.Close()

	res, _ := doJSON(t, srv, http.MethodGet, "/api/health", "", nil)
	if got := res.Header.Get("Access-Control-Allow-Origin"); got != "https://example.com" {
		t.Fatalf("Access-Control-Allow-Origin = %q", got)
	}
}

func TestClientIP(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "203.0.113.7:12345"
	if got := clientIP(r); got != "203.0.113.7" {
		t.Errorf("clientIP = %q, want 203.0.113.7", got)
	}

	r.Header.Set("X-Forwarded-For", "198.51.100.9, 10.0.0.1")
	if got := clientIP(r); got != "198.51.100.9" {
		t.Errorf("clientIP (xff) = %q, want 198.51.100.9", got)
	}
}
