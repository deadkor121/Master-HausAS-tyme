# MasterHaus AS TIME

Monorepo для управления заказами, сотрудниками, учётом часов и финансовыми сводками.

## Что есть в проекте

- API на Node.js + Express + TypeScript
- Web UI на React + Vite
- JWT-авторизация
- Заказы: CRUD
- Работники: CRUD
- Учёт часов: CRUD
- Платежи и расходы: CRUD
- Дашборд и финансовый отчёт

## Валюта

- Интерфейс проекта показывает финансовые данные в норвежских кронах (NOK)
- Формы для бюджета, ставок, платежей и расходов принимают ввод в NOK
- Внутри API и хранилища суммы сохраняются в øre, то есть в 1/100 норвежской кроны (NOK), чтобы не терять точность расчётов

## Стек

- Node.js
- npm workspaces
- Express
- React
- Vite
- Prisma
- PostgreSQL через Docker Compose

## Структура

- apps/api — backend API
- apps/web — frontend
- apps/api/prisma — схема Prisma и seed backend
- docker-compose.yml — PostgreSQL для локальной разработки

## Быстрый старт

Основной рабочий режим проекта теперь основан на Prisma + PostgreSQL.

Fallback-режим больше не является обычным сценарием запуска и должен использоваться только как аварийный локальный режим.

### 1. Установить зависимости

Из корня проекта:

```powershell
npm install
```

### 2. Запустить backend и frontend

Из корня проекта:

```powershell
npm run dev
```

Это запустит одновременно:

- API: http://localhost:3001
- Web: http://localhost:5173

Frontend автоматически проксирует запросы `/api` на backend.

### 3. Открыть приложение

Откройте в браузере:

```text
http://localhost:5173
```

## Демо-доступ

В проекте используется демо-пользователь:

- email: admin@masterhaus.no
- password: Masterhaus123!

Во frontend для большинства экранов демо-сессия поднимается автоматически.

## Режим базы данных

- Основной режим: Prisma + PostgreSQL
- Аварийный fallback доступен только при явной переменной окружения `ALLOW_FALLBACK_DB=true`
- Для обычной работы и тестирования fallback больше не нужен

## Основные команды

Из корня проекта:

### Запуск dev-режима

```powershell
npm run dev
```

### Тесты backend

```powershell
npm test
```

### Полная сборка

```powershell
npm run build
```

## Запуск по отдельности

### Только API

```powershell
npm run dev --workspace apps/api
```

### Только frontend

```powershell
npm run dev --workspace apps/web
```

## Как пользоваться приложением

### Orders

- открыть раздел Orders
- создать заказ
- просматривать список заказов
- бюджет вводится в NOK

### Workers

- открыть раздел Workers
- создать сотрудника
- редактировать сотрудника
- удалить сотрудника
- выбрать сотрудника
- добавить часы работы за месяц
- посмотреть salary preview на основе часов
- ставка работника вводится и показывается в NOK

### Accounting

- открыть раздел Accounting
- добавить payment
- добавить expense
- редактировать и удалять записи
- смотреть monthly report
- все суммы отображаются в NOK

### Admin Dashboard

- открыть раздел Admin
- смотреть overview активных заказов
- смотреть alerts

## PostgreSQL через Docker

Для основного рабочего режима нужен PostgreSQL:

### 1. Поднять контейнер PostgreSQL

Из корня проекта:

```powershell
docker compose up -d postgres
```

Параметры контейнера уже описаны в [docker-compose.yml](docker-compose.yml).

### 2. Подготовить переменные окружения API

Шаблон лежит в [apps/api/.env.example](apps/api/.env.example).

Минимально нужны:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/masterhaus
JWT_SECRET=dev-secret
```

### 3. Применить схему и сиды Prisma

Из корня проекта:

```powershell
npx prisma db push
npm run prisma:seed --workspace apps/api
```

### 4. Важное замечание

Теперь PostgreSQL/Prisma является основным режимом работы проекта.

Если вы хотите специально включить аварийный fallback-режим, используйте переменную окружения:

```env
ALLOW_FALLBACK_DB=true
```

## Полезные URL

- Web: http://localhost:5173
- API health: http://localhost:3001/api/v1/health
- Orders API: http://localhost:3001/api/v1/orders

## Проверка, что всё работает

### Backend healthcheck

Открыть:

```text
http://localhost:3001/api/v1/health
```

Ожидаемый ответ:

```json
{
  "status": "ok",
  "service": "masterhaus-api"
}
```

### Тесты

```powershell
npm test
```

### Сборка

```powershell
npm run build
```

## Текущее состояние проекта

Сейчас стабильно работают:

- локальный запуск
- основной режим Prisma/PostgreSQL
- тесты backend
- сборка backend и frontend
- управление заказами
- управление сотрудниками
- учёт часов
- salary preview
- финансовые записи и monthly report в NOK

## Ближайшие улучшения

- ввод часов не только из worker view, но и из order view
- более строгая модель ролей и отдельный экран логина
- улучшение аналитики и отчётов по заказам и бригадам