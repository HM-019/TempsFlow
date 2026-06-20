# TempsFlow

TempsFlow is a full-stack employee time tracking and management application. It allows employees to clock in and out, view their work history, add or correct missed shifts, and track their salary in real time based on their contract hours. Administrators can create employee accounts, monitor everyone's hours and salary, and reset passwords when needed.

**Live application:** [https://hm-019.github.io/TempsFlow/Frontend/login/login.html](https://hm-019.github.io/TempsFlow/Frontend/login/login.html)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Architecture](#project-architecture)
- [Project Structure](#project-structure)
- [Getting Started Locally](#getting-started-locally)
- [Installing as a PWA](#installing-as-a-pwa)
- [Security Features](#security-features)
- [API Overview](#api-overview)
- [Deployment](#deployment)

---

## Features

### Employee
- Clock in and clock out with a live session timer
- Persistent clock-in state — stays clocked in even after logout or closing the browser
- View daily, weekly, and monthly worked hours
- Full shift history filterable by month
- Add a missed day manually (clock-in and clock-out time)
- Edit an existing shift's times directly (no approval needed)
- Real-time salary tracking based on contract hours, with a separate overtime rate once contract hours are exceeded

### Administrator
- Create new employee or admin accounts, including contract hours per month
- View all employees with their monthly hours and days worked
- Open any employee's detail page to see their full shift history and salary breakdown for any month
- Reset any employee's password
- Fully responsive admin dashboard

### General
- Mobile-first responsive design with a collapsible sidebar and hamburger menu
- Installable as a Progressive Web App (PWA) on both iOS and Android
- JWT-based authentication with role-based access (employee vs admin)

---

## Tech Stack

### Frontend
- HTML5 for page structure
- CSS3 for styling and responsive design
- Vanilla JavaScript for client-side logic and API communication
- Progressive Web App (PWA) support using:
  - `manifest.json`
  - `service-worker.js`
  - Installable on mobile devices

### Backend
- Node.js runtime environment
- Express.js framework for building the REST API
- JWT (JSON Web Tokens) for authentication and session management
- bcrypt for secure password hashing
- CORS configuration for secure frontend-backend communication

### Database
- TiDB Cloud
  - Distributed SQL database
  - MySQL-compatible
  - Hosted in the cloud
  - Stores users, shifts, and correction requests
- `mysql2` package used to connect Node.js to TiDB

### Containerization
- Docker
  - Containerized frontend and backend services
  - Ensures consistent development and deployment environments
- Docker Compose
  - Orchestrates multiple containers
  - Simplifies local development and testing

### Version Control
- Git — source code version tracking
- GitHub — remote repository hosting, collaboration, and deployment source

### Deployment
- GitHub Pages
  - Hosts the frontend application
  - Automatically deploys after pushes to the main branch
- Render
  - Hosts the Node.js backend API
  - Automatically redeploys on GitHub pushes

---

## Project Architecture

```
Frontend (HTML/CSS/JS + PWA)
        │
        ▼
Render-hosted Express API
        │
        ▼
TiDB Cloud Database
```

---

## Project Structure

```
TempsFlow/
│
├── docker-compose.yml
│
├── Frontend/
│   ├── Dockerfile
│   ├── style.css
│   ├── manifest.json
│   ├── service-worker.js
│   ├── login/
│   │   ├── login.html
│   │   └── login.js
│   ├── user/
│   │   ├── user.html
│   │   └── user.js
│   └── admin/
│       ├── admin.html
│       └── admin.js
│
├── database/
│   ├── Dockerfile
│   └── src/
│       └── init.sql
│
└── Backend/
    ├── Dockerfile
    ├── package.json
    ├── server.js
    ├── db.js
    ├── middleware/
    │   ├── auth.js
    │   └── isAdmin.js
    └── routes/
        ├── auth.js
        ├── shifts.js
        └── admin.js
```

---

## Installing as a PWA

TempsFlow can be installed as a standalone app on both iPhone and Android, giving it its own home screen icon and a native app-like experience without needing the App Store or Play Store.

### On iPhone (Safari)

1. Open the app link in **Safari** (the PWA install option does not appear in Chrome on iOS):
   `https://hm-019.github.io/TempsFlow/Frontend/login/login.html`
2. Tap the **Share** icon at the bottom of the screen (the square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**.
4. Confirm the name and tap **Add** in the top right corner.
5. The TempsFlow icon now appears on your home screen and opens in full-screen mode, just like a native app.

### On Android (Chrome)

1. Open the app link in **Chrome**:
   `https://hm-019.github.io/TempsFlow/Frontend/login/login.html`
2. Tap the **three-dot menu** in the top right corner.
3. Tap **Add to Home screen** (or **Install app**, depending on your Chrome version).
4. Confirm by tapping **Add** or **Install**.
5. The TempsFlow icon now appears on your home screen and launches in standalone mode.

Once installed, the app behaves like a native application: it opens without the browser address bar, can be launched from the home screen, and reuses cached assets through the service worker for faster loading.

---

## Security Features

- Passwords hashed using bcrypt before being stored in the database
- JWT-based authentication for all protected routes
- Role-based access control (employee vs admin) enforced on the backend
- Environment variables used for all sensitive configuration (database credentials, JWT secret)
- Rate limiting applied on the login endpoint to prevent brute-force attempts
- CORS restrictions to only allow requests from the authorized frontend origin

---

## API Overview

### Auth
- `POST /api/auth/login` — authenticate and receive a JWT
- `GET /api/auth/me` — get the currently authenticated user's info

### Shifts (Employee)
- `POST /api/shifts/clock-in`
- `POST /api/shifts/clock-out`
- `GET /api/shifts/me`
- `GET /api/shifts/me/month/:month`
- `POST /api/shifts/manual` — add a missed day
- `PATCH /api/shifts/:id` — edit an existing shift
- `GET /api/shifts/summary/today`
- `GET /api/shifts/summary/week`
- `GET /api/shifts/summary/month/:month`
- `GET /api/shifts/salary/:month`

### Admin
- `GET /api/admin/users`
- `GET /api/admin/users/:id`
- `POST /api/admin/users` — create a new account
- `DELETE /api/admin/users/:id`
- `PATCH /api/admin/users/:id/password` — reset a user's password
- `GET /api/admin/shifts/:userId`
- `GET /api/admin/shifts/:userId/month/:month`
- `GET /api/admin/users/:id/salary/:month`

---

## Deployment

- The **frontend** is automatically deployed to **GitHub Pages** on every push to the `main` branch.
- The **backend** is automatically redeployed to **Render** on every push to the connected GitHub repository.
- The **database** is hosted on **TiDB Cloud**, a managed, MySQL-compatible distributed SQL database, removing the need to self-host or maintain a database server.