**Last Updated: May 29, 2026**

## 1. Introduction

Orkest ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information when you use our web application at https://orkest.wesluma.com ("the Service").

Please read this Privacy Policy carefully. By using the Service, you acknowledge the practices described in this policy.

## 2. Information We Collect

### 2.1 Information You Provide Directly

| Category                   | Specific Data                                                                                                                                 | Purpose                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Account Information**    | Email address, password (hashed), username (optional), avatar image                                                                           | Account creation, authentication, user identification |
| **Profile Information**    | Username, avatar, language/locale preferences, time zone                                                                                      | Personalizing your experience                         |
| **Task Data**              | Task titles, descriptions, priorities, labels, tags, due dates, time zone, schedules, recurrence rules, subtasks, project assignments, status | Core Service functionality                            |
| **AI Chat Data**           | Chat messages sent to the AI assistant (including structured JSON content and conversation history)                                           | AI assistant feature                                  |
| **AI Memory Data**         | User preferences, habits, and patterns inferred by the AI assistant (stored as key-value pairs with category and confidence score)           | Cross-session personalization of AI assistant         |
| **AI Usage Data**          | Daily conversation count, usage date                                                                                                          | Enforcing daily usage limits                          |
| **Voice Input**            | Audio recordings uploaded for transcription                                                                                                   | Voice-to-text feature for AI assistant                |
| **Focus Sessions**         | Session start/end times, duration, associated task, completion status                                                                         | Focus timer feature and statistics                    |
| **Settings & Preferences** | Theme (light/dark), time format, week start day, sleep hours, task buffer minutes, default view, digest preferences                           | Personalizing your experience                         |
| **Google Calendar Data**   | Calendar IDs, calendar names, OAuth tokens (access/refresh), sync tokens, event IDs, notification channel IDs                                  | Google Calendar synchronization feature               |
| **Notification Data**      | Push notification subscription (OneSignal player ID), notification preferences (push/email), scheduled reminder metadata                       | Task reminder notifications                           |

### 2.2 Information Collected Automatically

| Category                  | Specific Data                                                  | Purpose                            |
| ------------------------- | -------------------------------------------------------------- | ---------------------------------- |
| **Usage Data**            | Pages visited, features used, interactions, timestamps         | Service improvement, analytics     |
| **Device & Browser Data** | Browser type and version, operating system, device type        | Technical optimization, security   |
| **Log Data**              | IP address, request timestamps, HTTP headers, error logs       | Security, debugging, rate limiting |
| **Authentication Data**   | Session tokens, OAuth provider identifiers                     | Maintaining authenticated sessions |
| **Location Preferences**  | Selected time zone, locale settings (not precise GPS location) | Scheduling features, localization  |

### 2.3 Information from Third-Party Providers

When you sign in via **Google OAuth**, we receive:

- Your name (as registered with Google)
- Your email address (verified by Google)
- Your Google profile picture URL

When you connect **Google Calendar**, we additionally access:

- Your Google Calendar list (calendar IDs and names)
- Calendar events (for synchronization purposes only)
- We store OAuth tokens to maintain the sync connection

### 2.4 Information We Do NOT Collect

- Precise geolocation data;
- Contacts;
- Payment card information (all subscription payment transactions and billing are securely handled by Paddle, our Merchant of Record; Orkest does not collect, receive, or store your payment card numbers or credit card details);
- Biometric data (other than voice recordings you voluntarily upload);
- Sensitive personal data (health, religion, political affiliation, etc.);
- Browsing history outside the Service;
- Content from third-party apps or services (except Google OAuth profile data and Google Calendar data when you enable sync).

## 3. How We Use Your Information

We use your personal information for the following purposes:

### 3.1 Service Provision

- To create and manage your account;
- To provide task management, scheduling, and synchronization features;
- To enable Google Calendar synchronization (when you connect your Google account);
- To enable AI assistant functionality (including natural language processing);
- To store and apply user preferences and patterns learned by the AI assistant for cross-session personalization;
- To provide the Daily Digest feature, including AI-generated task summaries and motivational messages;
- To provide the Daily Quote feature, including fetching quotes and translating them into your preferred language;
- To provide the "Today in History" feature, including fetching historical events from Wikipedia and translating them into your preferred language;
- To provide the Daily Book Recommendation feature, including fetching book data and generating AI recommendations in your preferred language;
- To process voice recordings for transcription;
- To enable cross-device synchronization and real-time updates;
- To send push notifications and email reminders for scheduled tasks (via OneSignal and Inngest/Resend, only when you configure reminders);
- To generate export files (ICS, CSV, JSON) as requested.

### 3.2 Service Improvement

- To analyze usage patterns and improve the Service;
- To develop new features and optimize existing ones;
- To train and improve AI models (only with anonymized/non-personal data; see Section 3.5).

### 3.3 Security and Compliance

- To detect, prevent, and address fraud, abuse, security incidents, and technical issues;
- To enforce our Terms of Service;
- To comply with legal obligations and respond to lawful requests;
- To implement rate limiting and bot protection.

### 3.4 Communication

- To send service-related emails (verification OTP, password reset, account notifications);
- To send daily digest emails (task summary and curated content, only when you opt in);
- To send announcements about material changes to the Service or policies;
- **We do not send marketing or promotional emails** unless you explicitly opt in.

### 3.5 AI Training

We do **not** use your personal data, task content, or AI chat messages to train or improve third-party AI models. We may use aggregated, fully anonymized data for service improvement, which cannot reasonably be used to identify you. If our practice changes in the future, we will:

- Obtain your explicit consent;
- Provide an opt-out mechanism;
- Anonymize data before use.

## 4. Legal Bases for Processing (GDPR/UK Users)

If you are located in the EU/EEA or UK, we process your personal information based on the following legal bases:

| Processing Activity                      | Legal Basis                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| Account creation and management          | Performance of a contract (Art. 6(1)(b) GDPR)                               |
| Service feature delivery                 | Performance of a contract (Art. 6(1)(b) GDPR)                               |
| Email verification and password reset    | Performance of a contract / Legal obligation                                |
| AI chat and voice processing             | Performance of a contract (Art. 6(1)(b) GDPR)                               |
| Usage analytics                          | Legitimate interests (Art. 6(1)(f) GDPR) — improving the Service            |
| Security monitoring and fraud prevention | Legitimate interests (Art. 6(1)(f) GDPR) — protecting the Service and users |
| Compliance with legal obligations        | Legal obligation (Art. 6(1)(c) GDPR)                                        |

## 5. Data Sharing and Disclosure

### 5.1 Third-Party Service Providers

We share your data with the following essential service providers, who process data on our behalf under strict data processing agreements:

| Provider                      | Purpose                                                                                                                                        | Data Shared                                                                                                                                                            | Location              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **Supabase Inc.**             | Database hosting, authentication, real-time sync, file storage                                                                                 | Account data, task data, settings, session tokens                                                                                                                      | USA                   |
| **Vercel Inc.**               | Application hosting and deployment                                                                                                             | Usage data, server logs, IP addresses                                                                                                                                  | Global (edge network) |
| **Google LLC**                | Google Calendar synchronization, OAuth authentication                                                                                          | OAuth tokens, calendar IDs, calendar events (only when sync is enabled)                                                                                                | USA                   |
| **Alibaba Cloud (DashScope)** | AI chat completions, Daily Digest generation, Daily Quote translation, Today in History translation, Daily Book and Daily Movie translation and recommendation | AI chat messages, task summaries for Daily Digest, quote text for translation, historical event text for translation, book/movie metadata for translation and recommendation | China / Global        |
| **Wikimedia Foundation**      | Historical event data for "Today in History" feature                                                                                           | Date (month and day only)                                                                                                                                              | USA                   |
| **quote.wesluma.com**         | Quote data for Daily Quote feature                                                                                                             | Date (used as seed)                                                                                                                                                    | Global                |
| **book.wesluma.com**          | Book data for Daily Book Recommendation feature                                                                                                | Date (used as seed)                                                                                                                                                    | Global                |
| **movie.wesluma.com**         | Movie data for Daily Movie Recommendation feature                                                                                              | Date (used as seed)                                                                                                                                                    | Global                |
| **Deepgram, Inc.**            | Voice-to-text transcription                                                                                                                    | Audio recordings you upload                                                                                                                                            | USA                   |
| **Resend Inc.**               | Transactional and reminder email delivery                                                                                                      | Email address, reminder content                                                                                                                                        | USA                   |
| **OneSignal, Inc.**           | Push notification delivery                                                                                                                     | OneSignal player ID, notification content, device info                                                                                                                 | USA                   |
| **Inngest, Inc.**             | Scheduled email reminder delivery (background job processing)                                                                                  | Event data (task title, trigger time, email address)                                                                                                                   | USA                   |
| **Cloudflare, Inc.**          | Bot protection (Turnstile)                                                                                                                    | Browser fingerprint data, IP address                                                                                                                                   | Global (edge network) |
| **Upstash Inc.**              | Rate limiting (Redis)                                                                                                                          | IP address (transient, not stored)                                                                                                                                     | USA / Global          |
| **Paddle** (Paddle.com Market Limited / Paddle Payments) | Subscription payment processing, tax compliance, invoicing, and billing | Email address, billing address, country, transaction history, and tokenized payment identifiers (card details are processed directly by Paddle) | United Kingdom / Ireland |

### 5.2 Legal Disclosures

We may disclose your information if required to do so by law or in the good-faith belief that such action is necessary to:

- Comply with a legal obligation (subpoena, court order, or other legal process);
- Protect and defend our rights or property;
- Prevent or investigate possible wrongdoing in connection with the Service;
- Protect the personal safety of users or the public;
- Protect against legal liability.

### 5.3 Business Transfers

If Orkest is involved in a merger, acquisition, reorganization, or sale of assets, your information may be transferred as part of that transaction. We will notify you via email and/or a prominent notice on the Service before any such transfer takes effect.

### 5.4 We Do NOT Sell Your Personal Information

We do **not** sell, rent, or trade your personal information to third parties for their marketing or commercial purposes. This includes, for the purposes of the **California Consumer Privacy Act (CCPA)**, no "sale" or "sharing" of personal information for cross-context behavioral advertising.

## 6. International Data Transfers

Your personal information may be transferred to and processed in countries other than your country of residence, including the United States, where our service providers are located.

When we transfer personal information from the **EU/EEA/UK** to countries not deemed adequate by the European Commission, we rely on:

- **Standard Contractual Clauses (SCCs)** approved by the European Commission; and/or
- **UK International Data Transfer Agreement (IDTA)** and Addendum.

When we transfer personal information from **China (PIPL)** to other countries, we:

- Conduct a **Personal Information Protection Impact Assessment (PIPIA)** as required by PIPL;
- Implement necessary contractual and technical safeguards;
- Obtain your separate consent where required by law;
- Inform you of the recipient's name, contact information, processing purpose, and method.

## 7. Data Retention

We retain your personal information only for as long as necessary to fulfill the purposes described in this Privacy Policy:

| Data Type                     | Retention Period                                            |
| ----------------------------- | ----------------------------------------------------------- |
| Account information           | Until account deletion                                      |
| Task data                     | Until account deletion                                      |
| Google Calendar connections   | Until account deletion or disconnection                     |
| Reminder settings             | Until account deletion or item deletion                     |
| Push notification subscription | Until you revoke notification permission or account deletion |
| AI chat messages              | Until account deletion                                      |
| AI memory data                | Until account deletion (max 20 entries; stale entries auto-pruned) |
| Email digest preferences      | Until account deletion (opt-in only)                              |
| Daily digest messages         | 7 days (older records automatically purged)                 |
| Daily quote translations      | 7 days (older records automatically purged)                 |
| Today in History translations | 7 days (older records automatically purged)                 |
| Daily book translations       | 7 days (older records automatically purged)                 |
| Daily movie translations      | 7 days (older records automatically purged)                 |
| AI usage limits and counts    | 30 days (older records automatically purged)                |
| Voice recordings              | Until transcription is complete; deleted after processing   |
| Focus sessions                | Until account deletion                                      |
| Usage logs                    | 90 days (aggregated/anonymized data may be retained longer) |
| Email verification OTPs       | 24 hours                                                    |
| Session tokens                | Until session expiry or account deletion                    |

**Account Deletion:** You may delete your account at any time through the Settings page. Upon deletion, all your personal data across all database tables (projects, items, AI conversations, AI messages, AI user memories, AI usage data, user settings, user subscriptions, focus sessions, daily digests, daily digest email preferences, Google Calendar connections) and your Supabase Auth account will be permanently deleted within **30 days**. Your external notification subscriptions — including OneSignal push subscriptions, OneSignal email channel, Google Calendar notification channels, and any pending scheduled email reminders — will also be cancelled at the time of deletion. Residual copies may remain in backups for up to **30 additional days**.

## 8. Data Security

We implement appropriate technical and organizational measures to protect your personal information, including:

- **Encryption in transit:** All data transmitted between your browser and our servers is encrypted using TLS 1.3;
- **Encryption at rest:** Database storage is encrypted at rest via Supabase;
- **Authentication security:** Passwords are hashed and salted by Supabase Auth; session tokens are secure HTTP-only cookies;
- **Rate limiting:** Protection against brute force and abuse via Upstash Redis;
- **Bot protection:** Cloudflare Turnstile on auth endpoints;
- **Access controls:** Strict least-privilege access to production databases; no direct database access from client-side code;
- **Regular updates:** Dependencies are regularly updated to patch security vulnerabilities.

**No security measure is 100% effective.** We cannot guarantee the absolute security of your information. We encourage you to use strong, unique passwords and enable all available security features.

## 9. Your Rights and Choices

### 9.1 General Rights (All Users)

- **Access and Portability:** You can access and export your data via the Service's export features (ICS, CSV, JSON for AI conversations and memories). You may also request a copy of your personal data by contacting us.
- **Correction:** You can update your profile information, settings, and task data directly through the Service interface.
- **Deletion:** You can delete your account and all associated data through the Settings page at any time.

### 9.2 GDPR Rights (EU/EEA/UK Users)

In addition to the above, if you are located in the EU/EEA or UK, you have the right to:

- **Withdraw Consent:** Where processing is based on consent, you may withdraw at any time without affecting the lawfulness of processing based on consent before its withdrawal;
- **Restrict Processing:** Request restriction of processing of your personal data where applicable;
- **Object to Processing:** Object to processing based on legitimate interests, including profiling;
- **Data Portability:** Receive your personal data in a structured, commonly used, and machine-readable format (JSON);
- **Lodge a Complaint:** File a complaint with your local data protection authority (e.g., the ICO in the UK, or your national DP Authority in the EU).

To exercise these rights, contact us at **support@wesluma.com**. We will respond within **30 days**.

### 9.3 CCPA Rights (California Users)

If you are a California resident, you have the following rights under the CCPA:

- **Right to Know:** Request disclosure of the categories and specific pieces of personal information we have collected about you;
- **Right to Delete:** Request deletion of personal information we have collected (subject to certain exceptions);
- **Right to Opt-Out:** We do not sell or share your personal information, so no opt-out is necessary;
- **Right to Non-Discrimination:** We will not discriminate against you for exercising any of your CCPA rights;
- **Right to Correct:** Request correction of inaccurate personal information.

To exercise your CCPA rights, contact us at **support@wesluma.com**. We will verify your identity using the information associated with your account before processing your request.

### 9.4 PIPL Rights (China Users)

If you are located in mainland China, you have the following rights under the **Personal Information Protection Law (PIPL)**:

- **Right to Know and Decide:** Be informed of and decide on the processing of your personal information;
- **Right to Access:** Request access to your personal information processed by us;
- **Right to Copy/Portability:** Request a copy of your personal information;
- **Right to Correct:** Request correction of inaccurate or incomplete personal information;
- **Right to Delete:** Request deletion of your personal information under circumstances prescribed by law (including when processing purposes have been achieved, cannot be achieved, or are no longer necessary; or when we cease providing the Service);
- **Right to Withdraw Consent:** Withdraw your consent for processing, where processing is based on consent;
- **Right to Explain:** Request an explanation of our personal information processing rules;
- **Right to Diexi (Post-mortem):** Designate the handler of your personal information after your death (where permitted by law);
- **Right to Lodge a Complaint:** File a complaint with relevant Chinese authorities.

To exercise these rights, contact us at **support@wesluma.com**. We will respond within **15 working days**.

## 10. Cookies and Local Storage

### 10.1 What We Use

We use minimal cookies and local storage necessary for the Service to function:

| Type                                   | Purpose                                         | Duration               |
| -------------------------------------- | ----------------------------------------------- | ---------------------- |
| **Authentication Cookies** (HTTP-only) | Session management via Supabase SSR             | Session / configurable |
| **Local Storage**                      | Offline sync queue (`orkest-sync-queue`)        | Until cleared          |
| **Local Storage**                      | Zustand persisted state (settings, focus store) | Until cleared          |
| **Local Storage**                      | User preferences (language, theme, etc.)        | Until cleared          |

### 10.2 What We Do NOT Use

- We do **not** use third-party tracking cookies;
- We do **not** use advertising cookies;
- We do **not** use analytics cookies (Google Analytics, etc.);
- We do **not** use social media pixels;
- We do **not** engage in cross-site tracking;

### 10.3 Your Choices

Most browsers allow you to control cookies and local storage through their settings. However, disabling essential cookies/local storage may prevent the Service from functioning properly.

## 11. Third-Party Links

The Service may contain links to third-party websites or services (e.g., GitHub for support, Vercel for status). We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing them with any personal information.

## 12. Children's Privacy

The Service is not directed to individuals under the age of **16** (or the age of digital consent in your country). We do not knowingly collect personal information from children. If we become aware that a child has provided us with personal information, we will take steps to delete such information promptly. If you believe a child has provided us with personal data, please contact us at **support@wesluma.com**.

## 13. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. Material changes will be communicated as follows:

- **Email notification** to the email address associated with your account (at least **30 days** before the effective date for material changes);
- **In-app notification** upon your next visit to the Service;
- **Notice on the Service website**.

Your continued use of the Service after the effective date of the revised Privacy Policy constitutes your acceptance of the changes.

## 14. Data Protection Officer and Contact

Orkest has not appointed a statutory Data Protection Officer as we are not currently required to do so under applicable law. However, all privacy-related inquiries should be directed to:

**Privacy Contact:**

- **Email:** support@wesluma.com
- **Response Time:** We aim to respond within **48 hours** for general inquiries and within **30 days** for rights requests (or shorter periods as required by applicable law).

## 15. Governing Language

This Privacy Policy is drafted in English. While we may provide translations for convenience, the English version shall prevail in case of any conflict or inconsistency.

## 16. Specific Provisions for China Users (PIPL)

### 16.1 Controller Information

The controller of your personal information is:

- **Operator:** Orkest (contact via support@wesluma.com)

### 16.2 Processing Principles

We process your personal information in accordance with the principles of **lawfulness, legitimacy, necessity, and good faith**, and with respect for your privacy.

### 16.3 Sensitive Personal Information

Under PIPL, certain categories of personal information are classified as "sensitive personal information" and require enhanced protection. We do **not** actively collect sensitive personal information as defined by PIPL (e.g., biometric identification information, religious beliefs, specific identity, medical health, financial accounts, personal location tracking). The only potentially sensitive data we process is:

- **Voice recordings** you voluntarily upload for transcription purposes. We process this data only with your explicit consent, for the specific purpose of transcription, and delete the recordings immediately after processing.

If we need to process any other sensitive personal information in the future, we will:

- Obtain your **separate, explicit consent**;
- Inform you of the processing purpose and method;
- Implement enhanced security measures;
- Conduct a Personal Information Protection Impact Assessment (PIPIA) where required.

### 16.4 Processing of Minors' Personal Information

If you are under the age of **14**, you must obtain consent from a parent or guardian before using the Service. We do not knowingly collect personal information from children under 14 without such consent. If we become aware that we have collected personal information from a child under 14 without verified parental consent, we will delete that information promptly.

### 16.5 Impact Assessment

We conduct a **Personal Information Protection Impact Assessment (PIPIA)** before engaging in activities that have a significant impact on your rights, including automated decision-making and international data transfers.

### 16.6 Cross-Border Transfer Mechanisms

For transfers of personal information outside of China, we:

- Pass a security assessment organized by the Chinese cyberspace administration department (if required by law);
- Obtain your separate consent;
- Inform you of the recipient's name, contact information, processing purpose, method, and the types of personal information transferred;
- Ensure the recipient's processing activities meet the standards of protection required by PIPL through contractual arrangements.
