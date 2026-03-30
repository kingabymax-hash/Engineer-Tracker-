# FieldLog

Voice-powered field logging tool for client services. Record voice notes, auto-transcribe with OpenAI Whisper, extract structured fields with Google Gemini, and store in Airtable.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` with your keys:
   ```
   AIRTABLE_API_KEY=your_airtable_personal_access_token
   AIRTABLE_BASE_ID=your_airtable_base_id
   AIRTABLE_TABLE_NAME=FieldLog
   OPENAI_API_KEY=your_openai_api_key
   GOOGLE_API_KEY=your_google_api_key
   ```

3. Run the dev server:
   ```bash
   npm run dev
   ```

4. Open:
   - **Owner View** (record voice notes): [http://localhost:3000](http://localhost:3000)
   - **Engineer Dashboard**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add all env vars in Vercel project settings
4. Deploy

## Airtable Schema

The Airtable table `FieldLog` must have these fields:
- Record ID (Autonumber)
- Client Name (Single line text)
- Date Logged (Date)
- Type (Single select: Bug / Change Request / Upgrade / Complaint / Other)
- Priority (Single select: Low / Medium / High / Critical)
- Summary (Single line text)
- Full Description (Long text)
- Raw Transcript (Long text)
- Status (Single select: Open / In Progress / Completed)
- Assigned To (Single line text)
- Completed Date (Date)
# FieldLog
