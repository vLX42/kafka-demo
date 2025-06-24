const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Kafka } = require('kafkajs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Kafka configuration
const kafka = new Kafka({
  clientId: 'freight-booking-consumer',
  brokers: ['localhost:9092'], // Update with your Kafka brokers
  // Add authentication if needed
  // sasl: {
  //   mechanism: 'plain',
  //   username: 'your-username',
  //   password: 'your-password'
  // },
  // ssl: true
});

const consumer = kafka.consumer({ 
  groupId: 'freight-booking-frontend-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
});

// Topics to subscribe to
const TOPICS = [
  'pub.freightbooking-xygoq.booking',
  'pub.freight-booking-reques-ebezm.status'
];

// Store connected clients by customer ID
const customerConnections = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle customer subscription
  socket.on('subscribe', ({ customerId }) => {
    if (!customerId) {
      socket.emit('error', { message: 'Customer ID is required' });
      return;
    }

    console.log(`Client ${socket.id} subscribing to customer ${customerId}`);
    
    // Store the customer ID with the socket
    socket.customerId = customerId;
    
    // Add to customer connections map
    if (!customerConnections.has(customerId)) {
      customerConnections.set(customerId, new Set());
    }
    customerConnections.get(customerId).add(socket);
    
    socket.emit('subscribed', { customerId });
  });

  // Handle unsubscribe
  socket.on('unsubscribe', () => {
    if (socket.customerId) {
      const customerSockets = customerConnections.get(socket.customerId);
      if (customerSockets) {
        customerSockets.delete(socket);
        if (customerSockets.size === 0) {
          customerConnections.delete(socket.customerId);
        }
      }
      console.log(`Client ${socket.id} unsubscribed from customer ${socket.customerId}`);
      socket.customerId = null;
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (socket.customerId) {
      const customerSockets = customerConnections.get(socket.customerId);
      if (customerSockets) {
        customerSockets.delete(socket);
        if (customerSockets.size === 0) {
          customerConnections.delete(socket.customerId);
        }
      }
    }
  });
});

// Function to extract customer ID from Kafka message
function extractCustomerId(message) {
  try {
    const data = JSON.parse(message.value.toString());
    
    // For booking events
    if (data.data && data.data.customerId) {
      return data.data.customerId.toString();
    }
    
    // For status events
    if (data.data && data.data.customerId) {
      return data.data.customerId.toString();
    }
    
    // Fallback - check root level
    if (data.customerId) {
      return data.customerId.toString();
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting customer ID:', error);
    return null;
  }
}

// Function to format Kafka message for frontend
function formatMessageForFrontend(message, topic) {
  try {
    const data = JSON.parse(message.value.toString());
    
    return {
      id: data.messageId || Math.random().toString(36).substr(2, 9),
      timestamp: data.dateTime || new Date().toISOString(),
      topic: topic,
      partition: message.partition,
      offset: message.offset,
      key: message.key ? message.key.toString() : '',
      value: data,
      headers: message.headers ? Object.fromEntries(
        Object.entries(message.headers).map(([k, v]) => [k, v.toString()])
      ) : {}
    };
  } catch (error) {
    console.error('Error formatting message:', error);
    return null;
  }
}

// Start Kafka consumer
async function startKafkaConsumer() {
  try {
    await consumer.connect();
    console.log('Connected to Kafka');
    
    // Subscribe to topics
    await consumer.subscribe({ 
      topics: TOPICS,
      fromBeginning: false 
    });
    
    console.log('Subscribed to topics:', TOPICS);
    
    // Process messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          console.log(`Received message from ${topic}:${partition}:${message.offset}`);
          
          // Extract customer ID
          const customerId = extractCustomerId(message);
          
          if (!customerId) {
            console.log('No customer ID found in message, skipping');
            return;
          }
          
          // Check if any clients are subscribed to this customer
          const customerSockets = customerConnections.get(customerId);
          
          if (!customerSockets || customerSockets.size === 0) {
            console.log(`No clients subscribed to customer ${customerId}`);
            return;
          }
          
          // Format message for frontend
          const formattedMessage = formatMessageForFrontend(message, topic);
          
          if (!formattedMessage) {
            console.error('Failed to format message');
            return;
          }
          
          // Send to all clients subscribed to this customer
          customerSockets.forEach(socket => {
            socket.emit('kafka-event', formattedMessage);
          });
          
          console.log(`Sent message to ${customerSockets.size} clients for customer ${customerId}`);
          
        } catch (error) {
          console.error('Error processing message:', error);
        }
      },
    });
    
  } catch (error) {
    console.error('Error starting Kafka consumer:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await consumer.disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connectedCustomers: Array.from(customerConnections.keys()),
    totalConnections: Array.from(customerConnections.values()).reduce((sum, sockets) => sum + sockets.size, 0)
  });
});

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startKafkaConsumer();
});

module.exports = { app, server };