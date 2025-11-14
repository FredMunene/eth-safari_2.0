# ETH Safari 2025 Ops Hub

**A submission for the [ETH-Safari Hackathon 2025](https://dorahacks.io/hackathon/eth-safari-hackathon-2025/detail).**

This project is a web-based "Ops Hub" designed to streamline logistics and participant management for the ETH Safari hackathon. It provides a centralized dashboard for organizers to manage travel approvals, participant check-ins, and stipend disbursements, while offering a clear portal for participants to view their status.

## 🎯 The Problem We're Solving

Large-scale events like hackathons often rely on manual processes and spreadsheets for managing logistics, leading to several pain points:

1.  **Communication Gaps:** Difficulty in broadcasting verified updates (like schedule changes or bounty clarifications) to all participants reliably.
2.  **Lack of Structured Involvement:** It's hard to track contributions and commitments from volunteers, mentors, and participants in a transparent way.
3.  **Complex Logistics Management:** Managing travel, accommodations, and stipend disbursements for sponsored hackers is often a chaotic process, lacking a single source of truth and making audits difficult.

Our Ops Hub addresses these challenges by creating a transparent, verifiable, and efficient system for managing event operations.

## 🌊 How We Integrate AQUA Protocol

The core of the Ops Hub's trust and transparency comes from its integration with the **Aqua Protocol**. We use Aqua to create a tamper-proof, verifiable audit trail for all key logistical operations. Rather than minting attestations inside the Supabase edge function (which runs on Deno), we now proxy attestation requests to a dedicated **Node.js attestation service**. That Node server runs `aqua-js-sdk` in a Node runtime and writes the resulting hashes back to Supabase.

-   **Verifiable Approvals:** When an organizer approves a travel request, an Aqua attestation is created. This serves as an immutable proof of approval, containing details like the stipend amount and itinerary.
-   **On-Site Check-Ins:** Participants can be checked into venues using a QR code linked to their approval attestation. Each scan generates a signed "check-in" event, providing a verifiable record of attendance.
-   **Transparent Payouts:** When stipends/payments are disbursed, the transaction is recorded and linked to the participant's record as another Aqua proof. This closes the loop from approval to payment.

By using Aqua, we move critical operational data from fragile spreadsheets to a decentralized trust network, making the entire process transparent and auditable for organizers, participants, and auditors.

## 🚀 Getting Started

To run the project locally, follow these steps:

1.  **Clone the repository & inspect the layout:**
    ```bash
    git clone https://github.com/FredMunene/eth-safari_2.0
    cd eth-safari_2.0
    tree -L 1
    # .
    # ├── aqua-server/   -> Node/Express Aqua attestation microservice
    # └── web/           -> Vite + React frontend + Supabase proxy sources
    ```

2.  **Install dependencies (frontend + attestor):**
    ```bash
    cd web && npm install
    cd ../aqua-server && npm install
    cd ..
    ```

3.  **Set up environment variables:**
    - Create `web/.env` for the Vite app:
      ```
      VITE_SUPABASE_URL=your-supabase-url
      VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
      VITE_PRIVY_APP_ID=your-privy-app-id
      VITE_SUPABASE_FUNCTIONS_URL=https://<project>.functions.supabase.co
      ```
    - Create `aqua-server/.env` for the attestation service:
      ```
      PORT=8787
      AQUA_SERVICE_TOKEN=choose-a-strong-shared-secret
      SUPABASE_URL=your-supabase-url
      SUPABASE_SERVICE_ROLE_KEY=service-role-key
      AQUA_MNEMONIC="seed words for aqua-js-sdk"
      ```

4.  **Run the development servers:**
    ```bash
    # Terminal 1 - frontend
    cd web
    npm run dev
    # -> http://localhost:5173

    # Terminal 2 - Aqua Node service
    cd aqua-server
    npm run dev   # or node index.js
    ```

## 🛠️ Tech Stack

-   **Frontend:** React, TypeScript, Vite, Tailwind CSS
-   **Backend:** Supabase (for database and serverless functions)
-   **Authentication:** Privy
-   **Decentralized Trust:** Aqua Protocol (Node attestation microservice in `aqua-server/`)
