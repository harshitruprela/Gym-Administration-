# Iron Nation Gym - Full-Stack Administration Portal

A modern, responsive, and secure full-stack gym administration web application featuring a premium high-energy **Crimson Red & Dark Steel** glassmorphic interface. It is designed to be both customer-centric (for marking attendance, viewing streaks, and checking membership progress) and manager-centric (for administrative overview, manual desk check-ins, member directory CRUD, and plan management).

---

## ⚡ Features

### 1. Role-Based Authentication
- Centers access around a unified login portal.
- **Manager Portal**: Grants access to real-time analytics, daily attendance metrics, membership packages, and registry directories.
- **Customer Portal**: Displays athlete personal streaks, active plan status progress bars, check-in QR scanner, and historical records.

### 2. Intelligent Expirations & 3-Tier Membership Status
Members are dynamically evaluated on reads relative to the current calendar day:
- 🟢 **Active**: Members with more than 7 days of active subscription.
- 🟡 **Expiring Soon**: Warning status for members with **7 or less days** of subscription remaining.
- 🔴 **Expired**: Members whose subscription end date is in the past.

### 3. Double Check-In Prevention
- Restricts double check-ins (both self-service QR scans and manual desk check-ins) to **once per calendar day** to maintain accurate logs.

### 4. Dynamic Attendance Metrics
- Tracks total real-time daily check-ins against total active members (e.g., `2 / 6`).

### 5. Indian Localizations
- **Currency**: Pricing displays are formatted in **Indian Rupees (₹)**.
- **Phone Numbers**: Input forms and seeds default to **Indian (+91)** formatting.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom Variables, Flexbox/Grid, Animations), JavaScript (ES6+ Client-Side State), Lucide Icons.
- **Backend**: Node.js, Express.js.
- **Database**: Dual Gateway Adapter supporting **MongoDB (Cloud Atlas)** or **Local filesystem JSON file** fallback.
- **Deployment**: Configured for serverless hosting on **Vercel**.

---

## 🚀 Running Locally

1. **Clone or Navigate to the Workspace Directory**:
   ```bash
   cd gym-admin-server-app
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Local Server**:
   ```bash
   npm start
   ```
   *The server dynamically checks for available ports (fallback ports `3001`, `3002`, etc., if port `3000` is busy).*

4. **Open the browser**:
   Navigate to the URL printed in the terminal (e.g. `http://localhost:3000`).

---

## 🔐 Credentials for Testing

### Manager / Administrator Account
- **Email**: `admin@ironnation.com`
- **Password**: `admin123`

### Customer / Athlete Account
- **Email**: `marcus.v@example.com`
- **Password / Member ID**: `APX-3829` (The Member ID serves as their password)

---

## ☁️ Production Deployment (100% Free)

### Part 1: Set up Cloud Database (MongoDB Atlas)
1. Register for a free account on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free **M0 Sandbox** cluster.
3. Add a Database User (keep username/password) and add network access IP `0.0.0.0/0`.
4. Copy the connection driver string:
   ```text
   mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/ironnation?retryWrites=true&w=majority
   ```

### Part 2: Deploy Backend & Frontend (Vercel)
1. Push this project folder to your GitHub repository.
2. Sign in to [Vercel](https://vercel.com) using your GitHub account.
3. Import the `iron-nation-gym` repository.
4. Add the following **Environment Variables**:
   - `MONGODB_URI`: *Your Atlas connection string*
   - `ADMIN_EMAIL`: *Your custom manager email* (Optional - defaults to `admin@ironnation.com`)
   - `ADMIN_PASSWORD`: *Your custom manager password* (Optional - defaults to `admin123`)
5. Click **Deploy**. Vercel will host the app and provide a live URL!
