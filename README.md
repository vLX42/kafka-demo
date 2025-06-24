# Event-Driven Frontend with Kafka 🚢

> **DFDS Internal Knowledge Sharing Project**  
> Building reactive frontends with Kafka event streams

## 📋 Overview

This project demonstrates how to build **event-driven frontends** that react to Kafka events in real-time, moving away from traditional polling-based approaches to a more reactive, efficient system architecture.

### The Problem We're Solving

**Traditional Approach (Polling)**:
- Frontend constantly polls backend APIs every few seconds
- High server load and unnecessary network traffic
- Delayed updates and poor user experience
- Inefficient resource usage

**Event-Driven Approach (This Project)**:
- Frontend only updates when actual events occur
- Zero unnecessary API calls or polling
- Instant updates as soon as events happen
- Efficient resource usage and better UX

### Key Benefits
- **Instant Updates**: UI updates immediately when business events occur
- **Reduced Load**: No more constant polling - only update when needed
- **Real-time UX**: Users see changes as they happen, not after polling intervals
- **Scalable**: System scales better with event-driven architecture
- **Efficient**: Lower bandwidth and server resource consumption

## 🏗️ Event-Driven Architecture

### Traditional vs Event-Driven Comparison

**❌ Traditional Polling Approach**
```
Frontend ──┐ (Every 5s)  ┌── GET /api/bookings/:id
           │ GET Request │
           └─────────────┼── REST API Server
           ┌─────────────┼── Database Query
           │   Response  │
           └─────────────┘   (Even if no changes)
```

**✅ Event-Driven Approach**
```
Business Event ──► Kafka Topic ──► Event Consumer ──► WebSocket ──► Frontend Update
      │                                                                    │
      └─ Only when something actually happens ──────────────────────────────┘
```

### System Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│                     │    │                     │    │                     │
│   Kafka Topics      │───▶│   Event Bridge      │───▶│   Reactive Frontend │
│                     │    │                     │    │                     │
│ • Booking Created   │    │ • KafkaJS Consumer   │    │ • Instant Updates   │
│ • Status Changed    │    │ • Event Filtering    │    │ • Zero Polling      │
│ • Payment Processed │    │ • WebSocket Push     │    │ • Real-time UX      │
│                     │    │ • Connection Mgmt    │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

### Event Flow Example

1. **Business Event Occurs**: Customer booking status changes to "LoadedOntoVessel"
2. **Kafka Event Published**: Freight booking service publishes event to Kafka
3. **Event Consumer Processes**: Node.js server consumes and filters event
4. **Frontend Notified**: WebSocket pushes update to subscribed clients
5. **UI Updates Instantly**: React component updates booking status immediately

### Key Components

1. **Event Consumer** (Node.js + KafkaJS)
   - Consumes DFDS freight booking events in real-time
   - Filters events by customer ID for targeted updates
   - Bridges Kafka events to WebSocket connections

2. **WebSocket Layer** (Socket.IO)
   - Pushes events to connected frontends instantly
   - Manages customer-specific subscriptions
   - Handles connection lifecycle and reconnection

3. **Reactive Frontend** (React + Socket.IO)
   - Receives and displays events as they happen
   - No polling or periodic API calls needed
   - Updates UI components based on incoming events

## 📁 Project Structure

```
event-driven-frontend-kafka/
├── README.md                    # This documentation
├── backend/                     # Event consumer server
│   ├── server.js               # Kafka consumer + WebSocket bridge
│   ├── package.json            # Server dependencies
│   └── .env.example            # Kafka connection template
├── frontend/                    # Reactive frontend application
│   ├── components/
│   │   └── EventDrivenMonitor.tsx # Event-driven UI component
│   ├── package.json            # Frontend dependencies
│   └── README.md               # Frontend setup guide
└── presentation/                # Knowledge sharing materials
    ├── event-driven-frontend.pptx # PowerPoint presentation
    ├── demo-scenarios/          # Use case examples
    └── architecture-diagrams/   # System design visuals
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Access to DFDS Kafka environment
- Understanding of event-driven architecture concepts

### Backend Setup (Event Consumer)

1. **Navigate to backend folder**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Kafka connection**
   ```bash
   cp .env.example .env
   # Edit .env with your Kafka broker configuration
   ```

4. **Start the event consumer**
   ```bash
   npm start
   # Server runs on http://localhost:4000
   ```

### Frontend Setup (Reactive UI)

1. **Navigate to frontend folder**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open browser and test**
   - Navigate to the application
   - Enter a customer ID (e.g., 93884)
   - Click "Connect" to start receiving events
   - Watch as UI updates automatically when Kafka events occur

## 💡 Use Cases & Benefits

### Real-World Scenarios

**🚛 Freight Booking Updates**
- Customer books freight space
- Booking status changes propagate instantly to UI
- No need to refresh or poll for updates

**📋 Operational Dashboards**
- Operations team sees live booking statuses
- Instant notifications when vessels are loaded
- Real-time visibility into system state

**🔧 Development & Debugging**
- Developers can monitor event flows in real-time
- Debug issues as they happen
- Better understanding of system behavior

### Performance Benefits

| Aspect | Traditional Polling | Event-Driven |
|--------|-------------------|--------------|
| **API Calls** | Every 5-30 seconds | Only when events occur |
| **Server Load** | High (constant requests) | Low (event-triggered) |
| **Update Latency** | 5-30 seconds delay | Instant (< 1 second) |
| **Network Traffic** | High bandwidth usage | Minimal bandwidth |
| **User Experience** | Delayed, periodic updates | Real-time, immediate |

## 🛠️ Technical Implementation

### Event Consumer (server.js)
```javascript
// Consume Kafka events and filter by customer
const consumer = kafka.consumer({ groupId: 'frontend-group' });
await consumer.subscribe({ topics: FREIGHT_TOPICS });

await consumer.run({
  eachMessage: async ({ message }) => {
    const customerId = extractCustomerId(message);
    const connectedClients = getClientsForCustomer(customerId);
    
    // Push to frontend only when relevant events occur
    connectedClients.forEach(client => {
      client.emit('booking-event', formatEvent(message));
    });
  }
});
```

### Reactive Frontend Component
```jsx
// React component that updates based on events
const EventDrivenBookingView = () => {
  const [bookingData, setBookingData] = useState({});
  
  useEffect(() => {
    socket.on('booking-event', (event) => {
      // Update UI immediately when event received
      setBookingData(prev => ({
        ...prev,
        [event.bookingId]: event.data
      }));
    });
  }, []);
  
  // No polling, no intervals, just reactive updates
};
```

## 📊 Monitoring & Topics

### DFDS Kafka Topics
- `pub.freightbooking-xygoq.booking` - Booking lifecycle events
- `pub.freight-booking-reques-ebezm.status` - Status change notifications

### Event Types Handled
- **Booking Created** - New freight bookings
- **Status Updates** - LoadedOntoVessel, InTransit, Delivered
- **Payment Events** - Payment processed, failed, refunded
- **Operational Events** - Vessel assignments, route changes

## 🎯 Learning Outcomes

After exploring this project, you'll understand:

1. **Event-Driven Architecture Benefits**
   - Why events are better than polling for real-time UIs
   - How to reduce system load with reactive patterns

2. **Kafka Integration Patterns**
   - Consuming Kafka events in Node.js applications
   - Filtering and routing events to specific clients

3. **WebSocket Implementation**
   - Building real-time communication layers
   - Managing client connections and subscriptions

4. **Frontend Reactivity**
   - Creating UIs that respond to backend events
   - Eliminating unnecessary API polling

## 🔧 Configuration

### Environment Variables
```env
# Kafka Configuration
KAFKA_BROKERS=your-kafka-brokers
KAFKA_GROUP_ID=freight-frontend-consumer
KAFKA_CLIENT_ID=dfds-event-bridge

# Optional: Kafka Authentication
KAFKA_USERNAME=your-username
KAFKA_PASSWORD=your-password
KAFKA_SSL=true

# Server Configuration
PORT=4000
NODE_ENV=development
```

### Kafka Topics Configuration
```javascript
const TOPICS = [
  'pub.freightbooking-xygoq.booking',
  'pub.freight-booking-reques-ebezm.status'
];
```

## 📈 Next Steps & Extensions

### Potential Enhancements
1. **Event Replay** - Allow frontend to request historical events
2. **Event Filtering** - More granular event filtering options  
3. **Multi-tenant Support** - Handle multiple customer subscriptions
4. **Event Analytics** - Track event patterns and frequencies
5. **Offline Support** - Queue events when client is disconnected

### Production Considerations
- **Error Handling** - Robust error recovery and logging
- **Security** - Authentication and authorization for WebSocket connections
- **Scaling** - Handle multiple concurrent client connections
- **Monitoring** - Metrics and health checks for the event bridge

## 🤝 Contributing

This project is for DFDS internal knowledge sharing. Feel free to:
- Extend the examples with new use cases
- Add support for additional Kafka topics
- Improve the UI with better visualizations
- Document your own event-driven patterns

## 📋 Presentation Materials

The `presentation/` folder contains:
- **PowerPoint slides** explaining event-driven frontend concepts
- **Architecture diagrams** showing system design
- **Demo scenarios** for different use cases
- **Performance comparisons** between polling and event-driven approaches

Perfect for team presentations and knowledge sharing sessions!