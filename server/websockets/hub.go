// Package websockets is used to broadcast messages to connected clients
package websockets

import (
	"encoding/json"
	"sync/atomic"

	"github.com/axllent/mailpit/internal/logger"
	"github.com/gorilla/websocket"
)

// Hub maintains the set of active clients and broadcasts messages to the
// clients.
type Hub struct {
	// Registered clients.
	Clients map[*Client]bool

	// Inbound messages to fan out. A message carries the sandbox it belongs to
	// ("" = global) so the hub can deliver it only to clients watching that
	// sandbox.
	Broadcast chan wsMessage

	// Register requests from the clients.
	register chan *Client

	// Unregister requests from clients.
	unregister chan *Client

	// clientCount is an atomic count of connected clients, safe for concurrent reads.
	clientCount atomic.Int64
}

// WebsocketNotification struct for responses
type WebsocketNotification struct {
	Type string
	Data any
}

// wsMessage is a serialized notification tagged with the sandbox it belongs to
// ("" means a global event delivered to every client).
type wsMessage struct {
	sandbox string
	data    []byte
}

// NewHub returns a new hub configuration
func NewHub() *Hub {
	return &Hub{
		Broadcast:  make(chan wsMessage),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		Clients:    make(map[*Client]bool),
	}
}

// Run runs the listener
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			if _, ok := h.Clients[client]; !ok {
				logger.Log().Debugf("[websocket] client %s connected", client.conn.RemoteAddr().String())
				h.Clients[client] = true
				h.clientCount.Add(1)
			}
		case client := <-h.unregister:
			if _, ok := h.Clients[client]; ok {
				logger.Log().Debugf("[websocket] client %s disconnected", client.conn.RemoteAddr().String())
				delete(h.Clients, client)
				close(client.send)
				h.clientCount.Add(-1)
			}
		case message := <-h.Broadcast:
			prepared, err := websocket.NewPreparedMessage(websocket.TextMessage, message.data)
			if err != nil {
				logger.Log().Errorf("[websocket] error preparing message: %s", err.Error())
				continue
			}
			for client := range h.Clients {
				// A sandbox-scoped event reaches only clients watching that
				// sandbox. A global event (no sandbox), or a client with no
				// sandbox (single-tenant / sees-all), matches everything.
				if message.sandbox != "" && client.sandbox != "" && client.sandbox != message.sandbox {
					continue
				}
				select {
				case client.send <- prepared:
				default:
					close(client.send)
					delete(h.Clients, client)
					h.clientCount.Add(-1)
				}
			}
		}
	}
}

// Broadcast sends a global message to every connected client.
func Broadcast(t string, msg any) {
	sendToHub("", t, msg)
}

// BroadcastToSandbox sends a message only to clients watching sandboxID.
func BroadcastToSandbox(sandboxID, t string, msg any) {
	sendToHub(sandboxID, t, msg)
}

func sendToHub(sandbox, t string, msg any) {
	if MessageHub == nil || MessageHub.clientCount.Load() == 0 {
		return
	}

	b, err := json.Marshal(WebsocketNotification{Type: t, Data: msg})
	if err != nil {
		logger.Log().Errorf("[websocket] broadcast received invalid data: %s", err.Error())
		return
	}

	go func() { MessageHub.Broadcast <- wsMessage{sandbox: sandbox, data: b} }()
}

// BroadCastClientError is a wrapper to broadcast client errors to the web UI
func BroadCastClientError(severity, errorType, ip, message string) {
	msg := struct {
		Level   string
		Type    string
		IP      string
		Message string
	}{
		severity,
		errorType,
		ip,
		message,
	}

	Broadcast("error", msg)
}
