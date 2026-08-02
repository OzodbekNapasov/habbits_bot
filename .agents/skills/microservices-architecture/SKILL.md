---
name: microservices-architecture
description: Microservices architecture, message brokers (RabbitMQ/Kafka), and service communication.
---

# Microservices Architecture Skill

## Guidelines
1. **Loose Coupling**: Ensure services own their databases and communicate via APIs or message queues.
2. **Idempotency**: Ensure consumer handlers are idempotent to process duplicate messages safely.
3. **Circuit Breaker**: Implement circuit breakers to fail fast when downstream services are down.
4. **Distributed Tracing**: Pass trace headers (e.g. `X-Trace-Id`) across service boundaries.
5. **API Gateway**: Route client requests through a centralized API gateway.
