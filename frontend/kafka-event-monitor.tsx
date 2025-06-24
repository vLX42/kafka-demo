"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight, Pause, Play, Wifi, WifiOff } from "lucide-react"

interface KafkaEvent {
  id: string
  timestamp: string
  topic: string
  partition: number
  offset: number
  key: string
  value: any
  headers?: Record<string, string>
}

export default function Component() {
  const [customerId, setCustomerId] = useState<string>("")
  const [isConnected, setIsConnected] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [events, setEvents] = useState<KafkaEvent[]>([])
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Mock Kafka topics for demo
  const mockTopics = ["customer.events", "order.created", "payment.processed", "inventory.updated", "user.activity"]

  // Generate mock event data
  const generateMockEvent = (): KafkaEvent => {
    const topic = mockTopics[Math.floor(Math.random() * mockTopics.length)]
    const eventTypes = {
      "customer.events": ["profile_updated", "preferences_changed", "login"],
      "order.created": ["new_order", "order_modified", "order_cancelled"],
      "payment.processed": ["payment_success", "payment_failed", "refund_issued"],
      "inventory.updated": ["stock_changed", "product_added", "product_removed"],
      "user.activity": ["page_view", "button_click", "session_start"],
    }

    const eventType = eventTypes[topic as keyof typeof eventTypes]
    const randomEvent = eventType[Math.floor(Math.random() * eventType.length)]

    return {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      topic,
      partition: Math.floor(Math.random() * 3),
      offset: Math.floor(Math.random() * 10000),
      key: `customer_${customerId || Math.floor(Math.random() * 1000)}`,
      value: {
        eventType: randomEvent,
        customerId: customerId || Math.floor(Math.random() * 1000),
        data: {
          amount: topic === "payment.processed" ? Math.floor(Math.random() * 1000) : undefined,
          orderId: topic === "order.created" ? `order_${Math.floor(Math.random() * 10000)}` : undefined,
          productId: topic === "inventory.updated" ? `prod_${Math.floor(Math.random() * 100)}` : undefined,
          userId: `user_${Math.floor(Math.random() * 1000)}`,
          timestamp: Date.now(),
        },
      },
      headers: {
        "content-type": "application/json",
        source: "kafka-demo",
        version: "1.0",
      },
    }
  }

  const connectWebSocket = () => {
    if (!customerId) return

    setIsConnected(true)
    setEvents([])

    // Simulate WebSocket connection with interval
    intervalRef.current = setInterval(
      () => {
        if (!isPaused) {
          const newEvent = generateMockEvent()
          setEvents((prev) => [newEvent, ...prev].slice(0, 50)) // Keep only last 50 events
        }
      },
      2000 + Math.random() * 3000,
    ) // Random interval between 2-5 seconds
  }

  const disconnectWebSocket = () => {
    setIsConnected(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const togglePause = () => {
    setIsPaused(!isPaused)
  }

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents)
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId)
    } else {
      newExpanded.add(eventId)
    }
    setExpandedEvents(newExpanded)
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Consume Kafka Events in the Frontend</h1>
        <p className="text-gray-600">Real-time event monitoring through WebSocket</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Kafka Event Monitor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label htmlFor="customerId">Customer ID</Label>
              <Input
                id="customerId"
                type="number"
                placeholder="Enter customer ID"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                disabled={isConnected}
              />
            </div>
            <Button
              onClick={isConnected ? disconnectWebSocket : connectWebSocket}
              disabled={!customerId}
              variant={isConnected ? "destructive" : "default"}
            >
              {isConnected ? "Disconnect" : "Connect"}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600">Connected to WebSocket</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-500">Disconnected</span>
                </>
              )}
            </div>

            {isConnected && (
              <Button onClick={togglePause} variant="outline" size="sm" className="flex items-center gap-2">
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {isPaused ? "Resume" : "Pause"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Received Events ({events.length})</span>
              {isPaused && <Badge variant="secondary">Paused</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No events received yet...</p>
            ) : (
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {events.map((event) => (
                  <Collapsible key={event.id}>
                    <CollapsibleTrigger onClick={() => toggleEventExpansion(event.id)} className="w-full">
                      <div className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {expandedEvents.has(event.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <span className="text-sm font-medium text-blue-600">{event.topic}</span>
                            <span className="text-sm text-gray-700">{event.value.eventType}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{formatTimestamp(event.timestamp)}</span>
                            <span>
                              P{event.partition}:O{event.offset}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Card className="ml-6 mt-2 bg-gray-50">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-semibold text-sm mb-2">Event Details</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <strong>Key:</strong> {event.key}
                                </div>
                                <div>
                                  <strong>Partition:</strong> {event.partition}
                                </div>
                                <div>
                                  <strong>Offset:</strong> {event.offset}
                                </div>
                                <div>
                                  <strong>Timestamp:</strong> {event.timestamp}
                                </div>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-semibold text-sm mb-2">Payload</h4>
                              <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">
                                {JSON.stringify(event.value, null, 2)}
                              </pre>
                            </div>

                            {event.headers && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Headers</h4>
                                <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">
                                  {JSON.stringify(event.headers, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
