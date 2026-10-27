# CRM Business Rules & Logic Reference

This document outlines the operational rules, classification criteria, aging thresholds, and automated alert triggers implemented across the CRM tool.

---

## 1. Lead Categorization & KPI Metrics

Leads are classified into three overarching categories (**Active**, **Won**, or **Lost**) based on the values in their `Stage` and `Status` columns.

### Category Classification Matrix

| Category | Qualification Criteria (Case-Insensitive) | Effect on Dashboard |
| :--- | :--- | :--- |
| **Closed Won** | Stage contains: `won`, `closed won`, `converted`, `completed`, `hired`, `success` | Increments **Closed Won** KPI card. Excluded from overdue follow-up alerts. |
| **Closed Lost** | Stage contains: `lost`, `closed lost`, `dead`, `cold`, `dropped`, `not qualified`, `spam` | Increments **Closed Lost** KPI card. Excluded from overdue follow-up alerts. |
| **Active Leads** | Any stage/status that is neither Won nor Lost (e.g. `lead`, `contacted`, `proposal to be sent`, `proposal sent`, `negotiation`, `discovery`, `warm`, `hot`, `meeting`) | Increments **Active Leads** KPI card. Tracked for follow-ups and aging. |
| **Total Leads** | Total count of all non-tender, non-archived lead rows in the current view. | Displays total pipeline volume. |

---

## 2. Lead Status & Stage Options

### Status (Lead Temperature)
* **Hot**: High purchase intent, immediate priority. Included in the Executive Hot Pipeline email digest.
* **Warm**: Engaged prospect under active discussion.
* **Cold**: Low engagement or unresponsive, but not yet marked as Lost.

### Stage (Sales Lifecycle)
1. **Lead**: Newly identified contact or inbound inquiry.
2. **Contacted**: First outreach completed (email, message, or intro call).
3. **Proposal to be Sent**: Requirement captured; proposal/portfolio currently under preparation.
4. **Proposal sent**: Proposal delivered to client; awaiting feedback or review.
5. **Negotiation**: Reviewing commercials, deliverables, or contractual terms.
6. **Won**: Client agreed; deal finalized.
7. **Lost**: Deal dropped, cancelled, or rejected.

---

## 3. Stale Leads & Aging Thresholds

A lead is flagged as **Stale** when a proposal or portfolio has been delivered but no closing update has occurred within the standard turnaround cadence.

### Stale Qualification Criteria
A lead is evaluated for stale aging if **all** of the following conditions are met:
1. The lead's `Stage` is **`Proposal sent`** or **`Portfolio sent`**.
2. Neither `Status` nor `Stage` is marked as **Won**, **Lost**, **Dead**, or **Dropped**.
3. A valid date exists in the `Date` or `Follow up date` column.

### Aging Buckets & Risk Levels

| Aging Period | Classification | Meaning / System Action |
| :--- | :--- | :--- |
| **Days 0 to 5** | **Active Cadence** | Standard review window (Day 2 check-in & Day 5 reminder cadence). Not flagged as stale. |
| **Days 6 to 10** | **Overdue (Early Stale)** | Flagged as stale in the daily alert. Requires immediate touchpoint by Cog POC. |
| **Days 11 to 20** | **Critical Overdue** | Moderate risk of losing deal momentum. Escalated in the daily management summary. |
| **Day 21+** | **Severe Stale** | High risk of deal decay. Deals in this bracket represent the majority of **Value at Risk**. |

### Value at Risk
* **Definition**: The sum of all revenue estimations (`Revenue Estimations` or `Revenue Estimation (In INR)`) for active proposals that are **6+ days overdue**.

---

## 4. Master Follow-Up Dashboard Rules

The Follow-Ups view tracks scheduled check-ins, calls, and client touchpoints across all active accounts. (Note: Project/RFP `Deadline` dates are tracked separately as deal milestones and are excluded from the follow-up dashboard).

### Date Detection Priority
The tool scans the row for the first populated follow-up date from:
1. `Follow up date`
2. Any column containing `follow` or `followup` alongside `date` (excluding `deadline` or `due`)

### Follow-Up Filter Tabs

| Tab | Criteria | Business Meaning |
| :--- | :--- | :--- |
| **All** | Any open lead (not Won, Lost, or Dropped) with a recognized follow-up date. | Full active schedule overview sorted latest date first. |
| **Due Today** | Difference between scheduled date and today is exactly `0 days`. | Tasks and calls scheduled for today. |
| **Overdue** | Scheduled date is in the past (`daysDiff < 0`). | Missed follow-ups requiring immediate attention. |
| **Upcoming** | Scheduled date is in the future (`daysDiff > 0`). | Pipeline actions scheduled for future dates. |

### Interaction Type Rules
* **Meeting / Demo**: Inferred if `Intro Call` or notes contain `meeting`, `demo`, or `scheduled`.
* **Call**: Default interaction type assigned to all other scheduled follow-ups.

---

## 5. Proposal Tracker Rules

The Proposal Tracker monitors deals specifically in the proposal drafting and client review phases.

### Inclusion Criteria
A lead appears in the Proposal Tracker if its `Stage` contains:
* `proposal`
* `portfolio`
* `won`
* `lost`

### Kanban Column Mapping

| Column Title | Stage Matches | Lifecycle State |
| :--- | :--- | :--- |
| **Proposal to be Sent** | `proposal to be sent`, `proposal prep`, `preparing` | Proposal is being drafted. Flags if Cog POC is unassigned. |
| **Proposal Sent** | `proposal sent`, `proposal submitted`, `proposal` | Proposal delivered. System calculates aging days from sent date. |
| **Closed Won** | `won`, `closed won`, `converted`, `completed`, `success` | Proposal accepted and finalized. |
| **Closed Lost** | `lost`, `closed lost`, `dead`, `cancelled` | Proposal declined or abandoned. |

---

## 6. Tender Routing Rules

To avoid mixing public/corporate tenders with standard sales accounts:

* **Separation Rule**: Any row where `Source` or `Lead Source` contains **`Tender`** (case-insensitive) is automatically separated into the **Tender Dashboard** and hidden from Active Leads.
* **11 Tender Lifecycle Stages**:
  1. Tender Identified
  2. Under Review
  3. Qualification Check
  4. Bid Decision Pending
  5. Approved for Bidding
  6. Proposal Preparation
  7. Submitted
  8. Technical Evaluation
  9. Financial Evaluation
  10. Won
  11. Lost
* **Submission Deadline Rules**:
  * **Overdue**: Submission deadline is in the past and stage is not Won/Lost.
  * **Due Soon**: Submission deadline is between `0` and `3` days from today.
  * **Open**: More than 3 days remaining before submission deadline.

---

## 7. Floating "Due Today" Alert Box

* **Trigger**: A red floating notification appears on the top-right of the dashboard if any lead's `Deadline` or `Due Date` equals today's date.
* **Exclusion**: Leads without a deadline or leads with future/past deadlines do not trigger the alert.

---

## 8. Daily Automated Email Alerts (11:30 AM IST)

### Template 1: Daily Leads Digest
* **Hot Pipeline Table**:
  * Criteria: `Status == 'Hot'` and `Stage` is not Won, Lost, Dead, or Dropped.
  * Sorting: Highest deal value first.
  * Deduplication: If the same company appears multiple times, the highest value row is kept.
* **New Intake Section**:
  * Displays leads added yesterday (`Date == yesterday`).
  * Fallback: If no leads were added yesterday, surfaces the 6 most recent intake leads.
* **Test Filter**: Excludes rows where company name contains `test`, `demo`, `dummy`, or `sample`.

### Template 2: Proposals & Follow-up Action Alert
* **Proposals to Send**:
  * Highlights proposals queued for dispatch (`proposal to be sent`).
  * Triggers an amber leadership warning if any proposal has no Cog POC assigned.
* **Stale & Overdue Reminders**:
  * Lists sent proposals aged **Day 6+** grouped by risk buckets (6–10d, 11–20d, 21d+).
  * Calculates and highlights the total **Value at Risk**.

---

## 9. Google Sheets Archival & Hidden Rows

* **Hidden Rows (`_is_hidden`)**:
  * Rows hidden or collapsed directly in Google Sheets (via Google Sheet filter views or row hides) are flagged as `_is_hidden = true`.
  * By default, hidden rows are filtered out of the CRM dashboard to keep the active view clean.
  * Users can click the **Include Hidden Leads** toggle in the top bar to inspect archived or filtered rows.
