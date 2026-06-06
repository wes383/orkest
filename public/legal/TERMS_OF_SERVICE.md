**Last Updated: May 29, 2026**

## 1. Introduction

Welcome to Orkest ("the Application," "we," "us," or "our"). These Terms of Service ("Terms") govern your access to and use of the Orkest web application (located at https://orkest.wesluma.com), including all associated features, AI assistants, and services (collectively, "the Service").

Please read these Terms carefully before using the Service. By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.

## 2. Eligibility

By using the Service, you represent and warrant that:

- You are at least 16 years of age (or the age of digital consent in your country of residence);
- You have the full authority to enter into these Terms;
- You are not located in a country subject to a U.S. government embargo or designated as a "terrorist-supporting" nation; and
- You are not listed on any U.S. government list of prohibited or restricted parties.

If you are using the Service on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.

## 3. Account Registration and Security

### 3.1 Registration

To use the Service, you must register for an account. You may register via email and password or through supported third-party authentication providers (e.g., Google OAuth). You agree to provide accurate, current, and complete information during the registration process and to update such information as necessary.

### 3.2 Account Responsibility

You are solely responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You must notify us immediately at **support@wesluma.com** of any unauthorized use of your account or any other security breach.

### 3.3 Email Verification

Registration requires email verification via a one-time password (OTP) sent to your email address. Your access to certain features may be limited until your email is verified.

## 4. Description of the Service

Orkest is an AI-powered personal task orchestration application that provides, among other features:

- Task and project management with scheduling, priorities, tags, and subtasks;
- Recurring task support with custom recurrence rules;
- Multiple views: Today timeline, All tasks (timeline/list/calendar), and Focus (countdown/stopwatch);
- An AI assistant capable of managing tasks via natural language, providing scheduling suggestions, and answering queries about your tasks;
- AI memory: the assistant may learn and store your preferences, habits, and work patterns for cross-session personalization;
- Daily digest with AI-generated messages based on your task summary;
- Voice-to-text input for the AI assistant;
- Focus timer sessions with statistics tracking;
- Google Calendar synchronization (bidirectional sync of tasks and events, when you connect your Google account);
- Calendar export (ICS/CSV) and data export (JSON for AI conversations and memories);
- Cross-device synchronization via cloud infrastructure;
- Task reminder notifications via push (browser notifications) and email;
- Offline-first architecture with queued sync.

## 5. Acceptable Use

### 5.1 Prohibited Conduct

You agree not to, and not to attempt to:

- Use the Service for any unlawful purpose or in violation of any applicable local, national, or international law;
- Upload, store, or transmit any content that is harmful, threatening, abusive, harassing, defamatory, obscene, or otherwise objectionable;
- Interfere with or disrupt the integrity or performance of the Service or its infrastructure;
- Attempt to gain unauthorized access to the Service, other user accounts, or the underlying systems (including Supabase, database, or server infrastructure);
- Reverse-engineer, decompile, disassemble, or otherwise attempt to extract the source code of the Service;
- Use any automated means (bots, scrapers, crawlers, etc.) to access or interact with the Service without our express written permission;
- Use the Service to transmit any malware, viruses, or other harmful code;
- Use the AI assistant to generate, store, or process content that violates these Terms.

### 5.2 AI Feature Usage

The AI assistant and related features are provided as productivity aids. You are responsible for reviewing and approving any actions proposed by the AI before they are executed. We make no guarantees regarding the accuracy, completeness, or appropriateness of AI-generated content or suggestions.

### 5.3 AI Usage Limits

To ensure fair access and service stability, the AI assistant feature is subject to a daily usage limit. The default limit is **50 conversations per user per day** for users on the 7-day free trial, and **200 conversations per user per day** for users with an active Orkest Pro subscription. We reserve the right to adjust these limits at any time without prior notice. The usage counter resets daily at midnight (UTC). If you reach your daily limit, you will be unable to send additional AI messages until the next day.

## 6. User Content and Data

### 6.1 Ownership

You retain all ownership rights to the content, data, and information you create, store, or process using the Service ("Your Data"). We do not claim ownership over Your Data.

### 6.2 License to Operate the Service

By using the Service, you grant us a worldwide, non-exclusive, royalty-free license to access, use, process, copy, store, and transmit Your Data solely to the extent necessary to provide, maintain, and improve the Service (including backups, sync, AI processing, and compliance with legal obligations).

### 6.3 Data Processing

Certain Service features require processing Your Data through third-party services:

- **AI Features:** Task data and chat messages may be sent to Alibaba Cloud (via DashScope) or compatible AI providers as configured for the purpose of generating AI responses.
- **Voice Input:** Audio recordings may be sent to Deepgram for transcription.
- **Google Calendar Sync:** When you connect your Google Calendar, we access your calendar list and events through Google Calendar API to enable bidirectional synchronization. You can enable or disable sync for individual calendars at any time.
- **Push Notifications:** When you enable browser push notifications, your device is registered with OneSignal to receive reminder notifications. You can revoke notification permission at any time through your browser settings.
- **Email Reminders:** When you configure email reminders, task details and your email address are processed through Inngest and Resend to deliver scheduled reminder emails.

For details, see our Privacy Policy.

## 7. Third-Party Services and Dependencies

The Service relies on the following third-party providers, each with their own terms of service and privacy policies:

| Provider                  | Purpose                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase                  | Database, authentication, real-time sync                                                                                              |
| Vercel                    | Application hosting and deployment                                                                                                    |
| Google                    | Google Calendar synchronization, OAuth authentication                                                                                  |
| Alibaba Cloud (DashScope) | AI chat completions, task summaries, Daily Quote translation, Today in History translation, Daily Book and Daily Movie translation and recommendation |
| Wikimedia Foundation      | Historical event data (Wikipedia REST API)                                                                                            |
| quote.wesluma.com         | Quote data for Daily Quote feature                                                                                                    |
| book.wesluma.com          | Book data for Daily Book Recommendation                                                                                               |
| movie.wesluma.com         | Movie data for Daily Movie Recommendation                                                                                             |
| Cloudflare                | Bot protection (Turnstile)                                                                                                            |
| Deepgram                  | Voice-to-text transcription                                                                                                           |
| Resend                    | Transactional and reminder email delivery                                                                                             |
| OneSignal                 | Push notification delivery                                                                                                            |
| Inngest                   | Scheduled email reminder delivery (background job processing)                                                                         |
| Upstash                   | Rate limiting (Redis)                                                                                                                 |
| Paddle                    | Subscription payment processing, tax compliance, and invoicing (Merchant of Record)                                                   |

We are not responsible for the operation, availability, or security of these third-party services. Your use of these services through the Application is subject to their respective terms.

## 8. Intellectual Property Rights

### 8.1 Our IP

The Service, including its code, design, layout, graphics, logos, trademarks, and overall "look and feel" (excluding Your Data and open-source components), is owned by Orkest or its licensors and is protected by applicable intellectual property laws. The Service incorporates certain open-source software components, each governed by their respective licenses. Nothing in these Terms restricts your rights under those open-source licenses.

### 8.2 Feedback

If you provide us with suggestions, enhancement requests, recommendations, or other feedback regarding the Service, we may use such feedback without any obligation to you.

## 9. Fees and Payments

### 9.1 Subscription Model and Fees

The Service is provided under a subscription model:

- **7-Day Free Trial**: New users are eligible for a one-time 7-day free trial to experience all features of Orkest Pro. No credit card or payment information is required upfront. Upon expiration of the 7-day trial, your access will be suspended or limited to a read-only basic state unless you purchase a subscription.
- **Orkest Pro Subscription**: Orkest Pro is available at a rate of **$9.99 USD per month** (or local equivalents, plus applicable taxes). By subscribing to Orkest Pro, you authorize our Merchant of Record, Paddle, to charge your designated payment method on a recurring monthly basis.

### 9.2 Automatic Renewal, Cancellation, and Refunds

- **Automatic Renewal**: Your Orkest Pro subscription will automatically renew at the end of each billing cycle (monthly) unless you cancel your subscription before the renewal date.
- **Cancellation**: You may cancel your subscription at any time through the Billing section within your Account Settings, or by contacting our Merchant of Record, Paddle. Cancellation will prevent the next scheduled renewal charge, and you will retain full access to Orkest Pro until the end of your current billing period.
- **Merchant of Record**: All financial transactions, checkout procedures, tax calculation, and payment processing are securely handled by **Paddle** (Paddle Payments / Paddle.com Market Limited), acting as our official Merchant of Record.
- **Refunds**: Since we offer a 7-day free trial with no card upfront, subscriptions are generally non-refundable. However, if you believe you have been charged in error or have a specific billing dispute, please contact support@wesluma.com or Paddle customer support within 14 days of the charge.

### 9.3 Non-Payment

Failure to pay applicable fees may result in suspension or termination of your access to paid features or the Service as a whole.

## 10. Data Retention and Account Deletion

### 10.1 Account Deletion by You

You may delete your account at any time through the Settings page. Upon account deletion:

- Your account will be immediately disabled;
- All Your Data across all database tables will be permanently deleted within **30 days**;
- Residual copies may remain in backups for up to **30 additional days**;
- Deletion is irreversible.

### 10.2 Termination by Us

We may suspend or terminate your account at any time if:

- You violate these Terms;
- Your conduct could harm other users, third parties, or the Service;
- We are required to do so by law;
- We decide to discontinue the Service (with reasonable notice).

### 10.3 Data Export

Prior to account deletion, you may export your data using the ICS, CSV, or JSON export features available in the Service (including AI conversations and memories). We are not obligated to provide data after account termination.

## 11. Privacy

Your privacy is important to us. Our [Privacy Policy](./privacy-policy) explains how we collect, use, process, and protect your personal information. By using the Service, you agree to the practices described in the Privacy Policy.

## 12. Disclaimer of Warranties

THE SERVICE IS PROVIDED ON AN **"AS IS"** AND **"AS AVAILABLE"** BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, OR AVAILABILITY.

WE DO NOT WARRANT THAT:

- THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE;
- THE AI FEATURES WILL PRODUCE ACCURATE, RELIABLE, OR APPROPRIATE OUTPUT;
- ANY DEFECTS OR ERRORS WILL BE CORRECTED;
- THE SERVICE WILL MEET YOUR SPECIFIC REQUIREMENTS OR EXPECTATIONS.

YOU USE THE SERVICE AT YOUR OWN RISK. YOU ARE SOLELY RESPONSIBLE FOR YOUR TASK MANAGEMENT DECISIONS AND ANY ACTIONS TAKEN BASED ON AI-GENERATED SUGGESTIONS.

## 13. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:

- WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE;
- OUR TOTAL CUMULATIVE LIABILITY FOR ANY CLAIMS ARISING UNDER THESE TERMS SHALL NOT EXCEED THE GREATER OF (A) THE TOTAL AMOUNT YOU HAVE PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) USD $100;
- WE SHALL NOT BE LIABLE FOR ANY LOSS OF DATA, LOST PROFITS, OR BUSINESS INTERRUPTION, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

SOME JURISDICTIONS (INCLUDING THE EUROPEAN UNION) DO NOT ALLOW THE EXCLUSION OF CERTAIN WARRANTIES OR THE LIMITATION OF LIABILITY FOR CERTAIN DAMAGES. IF YOU ARE LOCATED IN SUCH A JURISDICTION, SOME OF THE ABOVE LIMITATIONS MAY NOT APPLY TO YOU.

## 14. Indemnification

You agree to indemnify, defend, and hold harmless Orkest, its operators, affiliates, and service providers from and against any claims, liabilities, damages, losses, and expenses (including reasonable attorneys' fees) arising out of or related to:

- Your use or misuse of the Service;
- Your violation of these Terms;
- Your violation of any applicable law or regulation;
- Your Data or any content you submit through the Service.

## 15. Governing Law and Dispute Resolution

### 15.1 Governing Law

These Terms shall be governed by and construed in accordance with the laws of the **People's Republic of China**, without regard to its conflict of law provisions.

### 15.2 Informal Resolution

Before initiating any legal proceeding, you agree to first contact us at **support@wesluma.com** and attempt to resolve the dispute informally for at least **30 days**.

### 15.3 Binding Arbitration (Outside Mainland China)

For users located outside Mainland China, any dispute arising from these Terms shall be finally settled by binding arbitration administered by the **Hong Kong International Arbitration Centre (HKIAC)** under its rules. The seat of arbitration shall be Hong Kong. The language of arbitration shall be English.

### 15.4 Consumer Rights (EU/EEA/UK)

If you are a consumer resident in the European Union, European Economic Area, or the United Kingdom:

- Nothing in these Terms affects your statutory rights under applicable consumer protection laws;
- You may bring proceedings in the courts of your country of residence, and nothing in Section 15.3 (Binding Arbitration) shall deprive you of that right.

### 15.5 California Users (CCPA)

If you are a California resident, you have specific rights regarding your personal information as described in our Privacy Policy.

## 16. Service Availability and Modifications

### 16.1 Modifications to the Service

We reserve the right to modify, suspend, or discontinue any part of the Service at any time, with or without notice. We will make reasonable efforts to provide advance notice of material changes.

We do not guarantee any specific level of service availability or uptime. While we strive to maintain the Service operational at all times, we do not offer service level agreements (SLAs) or uptime guarantees.

### 16.2 Modifications to These Terms

We may revise these Terms from time to time. Material changes will be communicated via email and/or in-app notification at least **30 days** before they take effect. Your continued use of the Service after the effective date constitutes acceptance of the revised Terms.

### 16.3 Beta Features

From time to time, we may offer new or experimental features ("Beta Features"). Beta Features are provided "as is" without any warranty and may be subject to additional terms. We may discontinue Beta Features at any time without notice.

## 17. Force Majeure

We shall not be liable for any delay or failure to perform our obligations under these Terms due to circumstances beyond our reasonable control, including but not limited to acts of God, natural disasters, war, terrorism, riots, government actions, internet service provider failures, or cyberattacks.

## 18. Severability

If any provision of these Terms is found to be unenforceable or invalid by a court of competent jurisdiction, that provision shall be limited or severed to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.

## 19. Entire Agreement

These Terms, together with the Privacy Policy, constitute the entire agreement between you and Orkest regarding your use of the Service and supersede any prior agreements or understandings.

## 20. Contact Information

For questions, concerns, or legal notices regarding these Terms, please contact us at:

- **Email:** support@wesluma.com
- **Website:** https://orkest.wesluma.com
