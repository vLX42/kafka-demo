const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { Kafka } = require("kafkajs");
const cors = require("cors");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Kafka setup
const kafka = new Kafka({
  clientId: "freight-booking-consumer",
  brokers: [process.env.KAFKA_BOOTSTRAP_SERVER],
  sasl: {
    mechanism: "plain",
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },
  ssl: true,
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID,
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
});

// Socket.IO logic using rooms
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("subscribe", ({ customerId }) => {
    if (!customerId) {
      socket.emit("error", { message: "Customer ID is required" });
      return;
    }

    const room = `cust${customerId}`;
    socket.join(room);
    socket.emit("subscribed", { room });
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  socket.on("unsubscribe", ({ customerId }) => {
    const room = `cust${customerId}`;
    socket.leave(room);
    console.log(`Socket ${socket.id} left room: ${room}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    // No manual cleanup needed – rooms are managed by Socket.IO
  });
});

// Kafka message parsing
function extractCustomerId(message) {
  try {
    const data = JSON.parse(message.value.toString());

    return (
      data?.data?.customerId?.toString() || data?.customerId?.toString() || null
    );
  } catch (err) {
    console.error("Failed to parse Kafka message", err);
    return null;
  }
}

function formatMessageForFrontend(message, topic) {
  try {
    const data = JSON.parse(message.value.toString());

    return {
      id: data.messageId || Math.random().toString(36).substr(2, 9),
      timestamp: data.dateTime || new Date().toISOString(),
      topic,
      partition: message.partition,
      offset: message.offset,
      key: message.key ? message.key.toString() : "",
      value: data,
      headers: message.headers
        ? Object.fromEntries(
            Object.entries(message.headers).map(([k, v]) => [k, v.toString()])
          )
        : {},
    };
  } catch (err) {
    console.error("Error formatting message", err);
    return null;
  }
}

// Kafka topics
const TOPICS = [
  "pub.freightbooking-xygoq.booking",
  "pub.freight-booking-reques-ebezm.status",
];

// Kafka consumer
async function startKafkaConsumer() {
  try {
    await consumer.connect();
    console.log("Connected to Kafka");

    await consumer.subscribe({ topics: TOPICS, fromBeginning: false });
    console.log("Subscribed to topics:", TOPICS);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const customerId = extractCustomerId(message);
        if (!customerId) return;

        const formatted = formatMessageForFrontend(message, topic);
        if (!formatted) return;

        const room = `cust${customerId}`;
        io.to(room).emit("kafka-event", formatted);
        console.log(`Emitted event to room: ${room}`);
      },
    });
  } catch (err) {
    console.error("Kafka error:", err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await consumer.disconnect();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    totalConnections: io.engine.clientsCount,
    timestamp: new Date().toISOString(),
  });
});

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startKafkaConsumer();
});
