"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  Pause,
  Play,
  Wifi,
  WifiOff,
  AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface KafkaEvent {
  id: string;
  timestamp: string;
  topic: string;
  partition: number;
  offset: number;
  key: string;
  value: any;
  headers?: Record<string, string>;
}

export default function Component() {
  const [customerId, setCustomerId] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [events, setEvents] = useState<KafkaEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [subscribedCustomerId, setSubscribedCustomerId] = useState<string>("");

  const socketRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Initialize Socket.IO connection
  const initializeSocket = () => {
    if (typeof window === "undefined") return null;

    try {
      const io = require("socket.io-client");
      const socket = io("http://localhost:4000", {
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
      });

      socket.on("connect", () => {
        console.log("Connected to server");
        setConnectionStatus("connected");
        setErrorMessage("");
        reconnectAttempts.current = 0;
      });

      socket.on("disconnect", (reason: string) => {
        console.log("Disconnected from server:", reason);
        setConnectionStatus("disconnected");
        setIsConnected(false);
        if (reason === "io server disconnect") {
          socket.connect();
        }
      });

      socket.on("connect_error", (error: Error) => {
        console.error("Connection error:", error);
        setConnectionStatus("error");
        setErrorMessage(`Connection failed: ${error.message}`);
        reconnectAttempts.current++;

        if (reconnectAttempts.current >= maxReconnectAttempts) {
          setErrorMessage(
            "Max reconnection attempts reached. Please check if the server is running on port 4000."
          );
        }
      });

      // 👇 Modified to support room name like "cust1234"
      socket.on("subscribed", ({ room }: { room: string }) => {
        console.log("Subscribed to room:", room);
        const match = room.match(/^cust(.+)$/);
        const id = match?.[1] || "unknown";
        setIsConnected(true);
        setSubscribedCustomerId(id);
        setEvents([]);
      });

      socket.on("kafka-event", (event: KafkaEvent) => {
        console.log("Received Kafka event:", event);
        if (!isPaused) {
          setEvents((prev) => [event, ...prev].slice(0, 100));
        }
      });

      socket.on("error", ({ message }: { message: string }) => {
        console.error("Server error:", message);
        setErrorMessage(message);
      });

      return socket;
    } catch (error) {
      console.error("Failed to initialize socket:", error);
      setErrorMessage(
        "Failed to initialize socket connection. Make sure socket.io-client is installed."
      );
      return null;
    }
  };

  const connectToKafka = () => {
    if (!customerId || !customerId.trim()) {
      setErrorMessage("Please enter a valid customer ID");
      return;
    }

    if (!socketRef.current) {
      socketRef.current = initializeSocket();
      if (!socketRef.current) return;
    }

    setConnectionStatus("connecting");
    setErrorMessage("");

    if (!socketRef.current.connected) {
      socketRef.current.connect();
    }

    const subscribeWhenConnected = () => {
      if (socketRef.current.connected) {
        socketRef.current.emit("subscribe", { customerId });
      } else {
        socketRef.current.once("connect", () => {
          socketRef.current.emit("subscribe", { customerId });
        });
      }
    };

    subscribeWhenConnected();
  };

  const disconnectFromKafka = () => {
    if (socketRef.current) {
      socketRef.current.emit("unsubscribe", {
        customerId: subscribedCustomerId,
      });
      socketRef.current.disconnect();
    }
    setIsConnected(false);
    setConnectionStatus("disconnected");
    setSubscribedCustomerId("");
    setEvents([]);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const clearEvents = () => {
    setEvents([]);
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getTopicDisplayName = (topic: string) => {
    if (topic.includes("booking")) return "Booking Events";
    if (topic.includes("status")) return "Status Events";
    return topic;
  };

  const getEventTypeFromValue = (value: any) => {
    if (value.type) return value.type;
    if (value.eventTrigger) return value.eventTrigger;
    if (value.data && value.data.status) return value.data.status;
    return "Unknown Event";
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "text-green-600";
      case "connecting":
        return "text-yellow-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-500";
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <Wifi className="h-4 w-4 text-green-500" />;
      case "connecting":
        return <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case "error":
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-400" />;
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return isConnected
          ? `Connected (Customer: ${subscribedCustomerId})`
          : "Connected to server";
      case "connecting":
        return "Connecting...";
      case "error":
        return "Connection error";
      default:
        return "Disconnected";
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Freight Booking Kafka Events
        </h1>
        <p className="text-gray-600">
          Real-time event monitoring for booking and status updates
        </p>
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

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
                type="text"
                placeholder="Enter customer ID (e.g., 93884)"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                disabled={isConnected}
              />
            </div>
            <Button
              onClick={isConnected ? disconnectFromKafka : connectToKafka}
              disabled={!customerId || connectionStatus === "connecting"}
              variant={isConnected ? "destructive" : "default"}
            >
              {connectionStatus === "connecting"
                ? "Connecting..."
                : isConnected
                ? "Disconnect"
                : "Connect"}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getConnectionStatusIcon()}
              <span className={`text-sm ${getConnectionStatusColor()}`}>
                {getConnectionStatusText()}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isConnected && (
                <>
                  <Button onClick={clearEvents} variant="outline" size="sm">
                    Clear Events
                  </Button>
                  <Button
                    onClick={togglePause}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    {isPaused ? (
                      <Play className="h-4 w-4" />
                    ) : (
                      <Pause className="h-4 w-4" />
                    )}
                    {isPaused ? "Resume" : "Pause"}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
            <p>
              <strong>Monitored Topics:</strong>
            </p>
            <ul className="list-disc list-inside mt-1">
              <li>
                pub.freightbooking-xygoq.booking - Booking updates and changes
              </li>
              <li>
                pub.freight-booking-reques-ebezm.status - Status change
                notifications
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Received Events ({events.length})</span>
              <div className="flex items-center gap-2">
                {isPaused && <Badge variant="secondary">Paused</Badge>}
                <Badge variant="outline">Customer {subscribedCustomerId}</Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="text-center py-12">
                <Wifi className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Waiting for Kafka events...</p>
                <p className="text-sm text-gray-400 mt-2">
                  Events for customer {subscribedCustomerId} will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {events.map((event) => (
                  <Collapsible key={event.id}>
                    <CollapsibleTrigger
                      onClick={() => toggleEventExpansion(event.id)}
                      className="w-full"
                    >
                      <div className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {expandedEvents.has(event.id) ? (
                              <ChevronDown className="h-4 w-4 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 flex-shrink-0" />
                            )}
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {getTopicDisplayName(event.topic)}
                              </Badge>
                              <span className="text-sm font-medium text-blue-600">
                                {getEventTypeFromValue(event.value)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{formatTimestamp(event.timestamp)}</span>
                            <span>
                              P{event.partition}:O{event.offset}
                            </span>
                          </div>
                        </div>

                        {/* Quick preview of important data */}
                        <div className="mt-2 text-left">
                          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                            {event.value.data?.releaseNumber && (
                              <span>
                                Release: {event.value.data.releaseNumber}
                              </span>
                            )}
                            {event.value.data?.status && (
                              <span>Status: {event.value.data.status}</span>
                            )}
                            {event.value.data?.customerReference && (
                              <span>
                                Ref: {event.value.data.customerReference}
                              </span>
                            )}
                            {event.value.data?.unitNumber && (
                              <span>Unit: {event.value.data.unitNumber}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Card className="ml-6 mt-2 bg-gray-50">
                        <CardContent className="p-4">
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-semibold text-sm mb-2">
                                Message Metadata
                              </h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <strong>Message ID:</strong>{" "}
                                  {event.value.messageId || "N/A"}
                                </div>
                                <div>
                                  <strong>Event ID:</strong>{" "}
                                  {event.value.eventId || "N/A"}
                                </div>
                                <div>
                                  <strong>Resource ID:</strong>{" "}
                                  {event.value.resourceId || "N/A"}
                                </div>
                                <div>
                                  <strong>Type:</strong>{" "}
                                  {event.value.type || "N/A"}
                                </div>
                                <div>
                                  <strong>Partition:</strong> {event.partition}
                                </div>
                                <div>
                                  <strong>Offset:</strong> {event.offset}
                                </div>
                                <div>
                                  <strong>Key:</strong> {event.key || "N/A"}
                                </div>
                                <div>
                                  <strong>Timestamp:</strong> {event.timestamp}
                                </div>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-semibold text-sm mb-2">
                                Event Data
                              </h4>
                              <pre className="bg-white p-3 rounded border text-xs overflow-x-auto max-h-96 overflow-y-auto">
                                {JSON.stringify(event.value.data, null, 2)}
                              </pre>
                            </div>

                            {event.value.eventTrigger && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">
                                  Event Trigger
                                </h4>
                                <p className="text-sm bg-white p-2 rounded border">
                                  {event.value.eventTrigger}
                                </p>
                              </div>
                            )}

                            {event.headers &&
                              Object.keys(event.headers).length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-2">
                                    Headers
                                  </h4>
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

      {!isConnected && connectionStatus === "disconnected" && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <WifiOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">
                Not connected to Kafka events
              </p>
              <p className="text-sm text-gray-400">
                Enter your customer ID and click Connect to start receiving
                real-time events
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
