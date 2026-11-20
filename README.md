# Feature Flag Management System

A backend-driven feature flag management system built with **Go and PostgreSQL**, designed to control application features dynamically without requiring application redeployments.

The platform provides centralized feature flag management, environment-specific configurations, percentage-based rollouts, secure admin authentication, and SDK APIs that allow client applications to retrieve feature configurations at runtime.

## 🚀 Key Features

- **Feature Flag Management:** Create and manage feature flags with different configuration types, including Boolean and Percentage-based flags.
- **Environment Management:** Maintain separate feature configurations across environments such as Development, Staging, and Production.
- **Percentage-Based Rollouts:** Gradually release features to a percentage of users instead of enabling them for everyone at once.
- **Configuration Versioning:** Maintain configuration versions to track changes and identify the latest configuration.
- **SDK Integration:** Expose dedicated SDK endpoints that allow client applications to fetch feature configurations.
- **API Key Authentication:** Secure SDK access using environment-specific API keys.
- **Admin Authentication:** Protect administrative operations using JWT-based authentication and cookie-based sessions.
- **Persistent Storage:** Store feature flags, environments, configurations, and related data in PostgreSQL.

## 🏗️ Architecture

The backend follows a modular architecture that separates HTTP handling, business logic, data access, and platform-level functionality.

```text
                 Admin Dashboard
                       |
                       | HTTP Requests
                       v
                Go Backend API
                       |
          +------------+------------+
          |            |            |
          v            v            v
       Admin         Feature      Environment
       Module         Module        Module
          |            |            |
          +------------+------------+
                       |
                       v
                 PostgreSQL
                       |
          +------------+------------+
          |                         |
          v                         v
     Configuration              API Keys
       Storage                  Storage


              Client Application
                       |
                       | API Key
                       v
                  SDK APIs
                       |
                       v
              Configuration Service
                       |
                       v
                  PostgreSQL
                       |
                       v
              Feature Configurations
```

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Go (Golang) | Backend development |
| PostgreSQL | Relational database |
| REST APIs | Client-server communication |
| JWT | Admin authentication |
| API Keys | SDK authentication |
| JSON | Feature configuration exchange |

## 📂 Project Structure

```text
flag_backend/
│
├── cmd/
│   └── server/
│
├── internal/
│   ├── modules/
│   │   ├── admin/
│   │   ├── apikey/
│   │   ├── configuration/
│   │   ├── environment/
│   │   └── ...
│   │
│   └── platform/
│       ├── response/
│       └── ...
│
├── go.mod
├── go.sum
└── ...
```

The backend is organized around independent modules, each responsible for a specific domain.

- **Modules:** Handle domain-specific operations, business logic, and database interactions.
- **Platform:** Contains reusable infrastructure and shared functionality.
- **SDK APIs:** Provide endpoints for external applications to retrieve feature configurations.

## ⚙️ How It Works

### 1. Admin Authentication

Administrators authenticate through the login API. The backend validates credentials and establishes an authenticated session using JWT-based cookie authentication.

Protected administrative endpoints require valid authentication.

### 2. Environment Management

Administrators can create and manage multiple environments.

Each environment maintains its own feature configurations, allowing different feature behavior across development, staging, and production.

### 3. Feature Configuration

Feature flags support different configuration types.

**Boolean Configuration**

Controls whether a feature is enabled or disabled.

```json
{
  "type": "BOOLEAN",
  "config": {
    "enabled": true
  }
}
```

**Percentage Configuration**

Controls the percentage of users who should receive a feature.

```json
{
  "type": "PERCENTAGE",
  "config": {
    "enabled": true,
    "percentage": 50
  }
}
```

### 4. Configuration Versioning

Configuration changes are tracked using version numbers.

This allows the system to identify configuration updates and maintain version information at both the environment and individual feature configuration levels.

### 5. Percentage-Based Rollout

Features can be gradually released to a percentage of users.

Instead of enabling a feature for everyone immediately, the rollout percentage controls the intended exposure.

This supports controlled releases and reduces the risk associated with introducing new functionality.

### 6. SDK Integration

Client applications interact with the backend through dedicated SDK endpoints.

The SDK authenticates using an API key associated with an environment and retrieves the corresponding feature configurations.

Example configuration response:

```json
{
  "environment": "Web Development",
  "version": 10,
  "configs": {
    "test_checkout": {
      "type": "BOOLEAN",
      "config": {
        "enabled": true
      },
      "version": 3
    },
    "checkout_experiment": {
      "type": "PERCENTAGE",
      "config": {
        "enabled": true,
        "percentage": 50
      },
      "version": 1
    }
  }
}
```

This allows applications to retrieve feature configurations dynamically without hardcoding feature states into their application code.

## 📡 API Endpoints

The backend exposes REST APIs for administrative operations and SDK integration.

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/login` | Authenticate administrator |
| POST | `/logout` | End administrator session |

### API Key Management

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api-keys` | Create an SDK API key |

### SDK APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/sdk/v1/configs/{featureKey}` | Retrieve a feature configuration |

SDK requests use API key authentication to identify and authorize the associated environment.

*Note: These are the core endpoints documented here. Additional administrative routes can be added as the API evolves.*

## 🗄️ Database

PostgreSQL is used for persistent storage.

The database manages the relationships between administrators, environments, feature configurations, and API keys.

Configuration version information is maintained to track updates and support version-aware SDK integration.

## 🔧 Getting Started

### Prerequisites

- Go
- PostgreSQL
- Git

### 1. Clone the repository

```bash
git clone https://github.com/ashrinc/Feature_flag.git

cd Feature_flag
```

### 2. Configure environment variables

Create a `.env` file using the configuration required by the backend.

Add your PostgreSQL connection details, authentication secrets, and other application settings.

### 3. Install dependencies

```bash
go mod download
```

### 4. Start the backend

```bash
go run ./cmd/server
```

The backend will start using the configured application settings.

## 🎯 Project Objective

The goal of this project is to build a centralized feature flag backend that enables applications to control feature availability dynamically.

By separating feature configuration from application deployments, the system supports safer releases, environment-specific behavior, and gradual feature rollouts.

The modular backend architecture also makes it easier to extend the platform with additional configuration types and SDK capabilities.

---

**Built with Go and PostgreSQL.**
