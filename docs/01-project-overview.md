# 1. Project Overview

## Project Name
**Azan Dashboard**

## Description
The Azan Dashboard is a comprehensive digital signage and automation solution designed to manage and display Islamic prayer times (Salah). Unlike standard mobile applications that simply show start times, this system is architected as a **central hub** for mosques and smart homes. It combines a visually distinct "Focus" display, accurate congregation (Iqamah) calculations, and powerful audio automation capabilities that integrate with local speakers and smart home devices (Alexa/VoiceMonkey).

![Main Dashboard View showing the Split Layout](./images/dashboard-view.png)

## Purpose and Problem Statement
### The Problem
*   **Static Timetables:** Mosques often rely on paper timetables or manual clock adjustments for congregation times, which become outdated quickly.
*   **Lack of Automation:** Home users struggle to synchronise Azan audio across different devices (e.g., dedicated speakers vs. Alexa) without complex, unstable scripts.
*   **Configuration Complexity:** Existing solutions often lack the granularity to handle specific mosque rules (e.g., "Maghrib Iqamah is 5 minutes after Adhan, but Isha is fixed at 8:00 PM").

### The Solution
Azan Dashboard provides a self-hosted, web-based platform that:
1.  **Centralises Logic:** Acts as the single source of truth for time calculations.
2.  **Automates Audio:** Generates high-quality Arabic/English announcements (Text-to-Speech) and plays them on multiple targets simultaneously.
3.  **Ensures Resilience:** Caches data locally to function perfectly during internet outages.

## Target Audience
*   **Mosque Administrators:** utilising the dashboard on large TV screens to inform the congregation of upcoming prayers and silent times.
*   **Home Lab Users:** deploying the system on Raspberry Pis or servers to automate their home audio environment and keep family members aware of prayer times.
*   **Developers:** looking for a modular, extensible Node.js/React foundation for Islamic time-based applications.