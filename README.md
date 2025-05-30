# Comms Message SFU

[![Coverage Status](https://coveralls.io/repos/github/decentraland/comms-message-sfu/badge.svg)](https://coveralls.io/github/decentraland/comms-message-sfu)

A microservice that handles real-time message routing and validation for Decentraland's communications infrastructure. Built to operate as a LiveKit participant, it receives directed chat messages from clients, validates their community context, and re-publishes them to the appropriate recipients using `destinationIdentities`.

## Table of Contents

- [🌟 Features](#-features)
- [🏗 Architecture](#-architecture)
- [🚀 Getting Started](#-getting-started)

  - [Prerequisites](#prerequisites)
  - [Local Development](#local-development)
  - [Environment Variables](#environment-variables)

- [🧪 Testing](#-testing)
- [🔄 CI/CD](#-cicd)

## 🌟 Features

- Real-time message interception and forwarding via LiveKit
- LiveKit participant identity used as message entrypoint
- Validation of community membership and sender legitimacy
- Server-side resolution of `destinationIdentities`
- Stateless client-side logic with clean separation of concerns
- Scalable via multiple service replicas

## 🏗 Architecture

The service acts as a participant within a LiveKit room. Clients send community messages to this service via `sendData(destinationIdentities: ["sfu-replica-x"])`. Upon receiving the message, the service:

1. Validates sender membership against the Social Service
2. Resolves active members of the target community
3. Sends a new message using LiveKit’s `sendData` with the resolved destination identities

```mermaid
sequenceDiagram
    participant UnityClient as Unity Client
    participant LiveKit as LiveKit Room
    participant SFU as Comms Message SFU

    UnityClient->>LiveKit: sendData(destinationIdentities: ["comms-message-sfu-1"], topic: "community:community-id", content)
    LiveKit-->>SFU: Message delivered to comms-message-sfu-1
    SFU->>SFU: Validate sender & resolve community members
    SFU->>LiveKit: sendData(destinationIdentities: ["user-a", "user-b", ...])
    LiveKit-->>UnityClient: Display message in community chat
```

Components:

- **LiveKit Client**: Subscribes to and sends messages
- **Membership Resolver**: Resolves community membership (DB/Redis/API)
- **Validator**: Checks sender legitimacy
- **Message Forwarder**: Publishes messages to correct users

## 🚀 Getting Started

### Prerequisites

- Node.js v20+
- LiveKit server instance and token generation access

### Local Development

1. Clone the repository

```bash
git clone https://github.com/decentraland/comms-message-sfu.git
cd comms-message-sfu
```

2. Install dependencies:

```bash
yarn install
```

3. Start the development environment:

```bash
docker-compose up -d
```

4. Run the service:

```bash
yarn dev
```

### Environment Variables

```
LIVEKIT_HOST=your-livekit-host
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
LIVEKIT_ROOM_ID=your-room-id
LIVEKIT_IDENTITY_PREFIX=your-identity-prefix
REPLICA_ID=your-replica-id
```

See `.env.default` for all available options.

## 🧪 Testing

The project uses Jest for testing. Run tests with:

```bash
yarn test
```

## 🔄 CI/CD

The project uses GitHub Actions for:

- Continuous Integration
- Docker image building
- Automated deployments to dev/prod environments
- Dependency management with Dependabot

### Deployment Environments

- **Development**: Automatic deployments on main branch
- **Production**: Manual deployments via GitHub releases
