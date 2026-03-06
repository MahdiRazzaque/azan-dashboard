# 1. Project Overview

## Introduction

The Azan Dashboard is a comprehensive digital signage and automation solution designed for mosques, Islamic centres, and smart homes. It serves as a central hub for Islamic prayer times, combining accurate real-time calculations with congregation (Iqamah) management and multi-room audio automation — including TTS-generated Adhans and Iqamah announcements.

It addresses the challenge of manual prayer time tracking and announcement by integrating reliable data sources with configurable output targets, ensuring the call to prayer is heard exactly when required — whether on local speakers, network browsers, or Amazon Alexa devices.

![Main Dashboard View](./images/dashboard-view.png)
*Figure 1: The main Azan Dashboard displaying the prayer timetable alongside the Focus Clock countdown.*

## Core Value Proposition

| Pillar | Description |
| :--- | :--- |
| **Accuracy & Localisation** | Fetches prayer times based on precise GPS coordinates or mosque-specific IDs. Supports all major calculation methods (ISNA, MWL, Karachi, etc.) and Madhab settings. |
| **Full Automation** | Completely automates Adhan and Iqamah announcements without manual intervention, using a precision scheduler. |
| **Customisation** | Allows custom audio files or Text-to-Speech (TTS) generation for dynamic, multilingual announcements. |
| **Extensibility** | Built on Factory and Strategy patterns with strict Zod validation, enabling plug-and-play additions of new prayer time sources and audio output targets. |
| **Resilience** | Local caching of annual prayer data ensures the system functions for months without internet access. |

## Problem Statement

- **Static Timetables:** Mosques often rely on paper timetables or manual clock adjustments for congregation times, which become outdated quickly.
- **Lack of Automation:** Home users struggle to synchronise Azan audio across different devices (e.g., dedicated speakers vs. Alexa) without complex, unstable scripts.
- **Configuration Complexity:** Existing solutions lack the granularity to handle specific mosque rules (e.g., "Maghrib Iqamah is 5 minutes after Adhan, but Isha is fixed at 20:00").

## The Solution

Azan Dashboard provides a self-hosted, web-based platform that:

1. **Centralises Logic:** Acts as the single source of truth for prayer time calculations and congregation scheduling.
2. **Automates Audio:** Generates high-quality Arabic and English announcements (Text-to-Speech) and plays them on multiple targets simultaneously.
3. **Ensures Resilience:** Caches data locally to function perfectly during internet outages.

## Target Audience

- **Mosque Administrators:** Seeking a reliable, hands-off digital signage and audio announcement system for display on large screens.
- **Home Lab Users:** Deploying the system on Raspberry Pis or home servers to automate their audio environment and keep family members informed of prayer times.
- **Developers & Contributors:** Looking to extend the system with new prayer time providers or audio output strategies.

## High-Level Architecture

The project is a monorepo consisting of three components:

1. **Backend (Node.js / Express 5):** Handles core business logic, scheduling, cache management, configuration, and the REST API.
2. **Frontend (React 18 / Vite):** Provides the administrative dashboard and digital signage display as a Single Page Application.
3. **TTS Microservice (Python / FastAPI):** A dedicated sidecar service utilising `edge-tts` for high-quality neural speech audio generation.

![System Architecture Diagram](./images/architecture-diagram.png)
*Figure 2: High-level system architecture showing the three components and their interactions.*

*For a detailed technical breakdown, refer to the [Architecture Documentation](./04-architecture.md).*

## Documentation Map

| Document | Description |
| :--- | :--- |
| [01 - Overview](./01-overview.md) | This document. Purpose, problem statement, and target audience. |
| [02 - Features](./02-features.md) | Comprehensive feature catalogue covering the dashboard, settings, and automation. |
| [03 - Setup & Installation](./03-setup-installation.md) | Prerequisites, environment configuration, Docker and manual deployment guides. |
| [04 - Architecture](./04-architecture.md) | Technology stack, backend/frontend patterns, data persistence, and extension points. |
| [05 - Automation Logic](./05-automation-logic.md) | Scheduler lifecycle, trigger events, TTS pipeline, and audio routing. |
| [06 - API Reference](./06-api-reference.md) | Exhaustive REST API endpoint documentation with request/response shapes. |
| [07 - Operations & Deployment](./07-ops-deployment.md) | Security hardening, CI/CD pipeline, reverse proxy configuration, and monitoring. |
| [08 - Development Guide](./08-development-guide.md) | Contributing workflow, testing strategy, coding standards, and extension tutorials. |
| [09 - Configuration Reference](./09-configuration-reference.md) | Full configuration schema documentation with defaults and constraints. |
