package main

import (
    "encoding/json"
    "net/http"
)

type APIResponse struct {
    Message string `json:"message"`
    Status  int    `json:"status"`
}

func main() {
    http.HandleFunc("/hello", helloHandler)
    http.HandleFunc("/goodbye", goodbyeHandler)
    http.ListenAndServe(":8080", nil)
}

func helloHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    response := APIResponse{
        Message: "Hello from the API!",
        Status:  200,
    }
    json.NewEncoder(w).Encode(response)
}

// Type the function below and test inline completion
func goodbyeHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    // Start typing here to test completion without markdown
    
}