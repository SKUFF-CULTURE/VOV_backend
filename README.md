# Голос победы `(Docker Compose AIO)`

## 📌 Описание проекта
Проект содержит полный бекенд, позволяет развернуть полный рабочий цикл на одном хосте.

---

## ⚙️ Установка и запуск `(AIO)`

### 1️⃣ Установите `Chocolatey` (Windows)
Если у вас ещё нет Chocolatey, установите его с помощью PowerShell (от имени администратора):

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```
### 2️⃣ Установите `make` через Chocolatey

```powershell
choco install make
```
```powershell
make --version
```
### 3️⃣ Соберите контейнеры

```bash
make build
```
### 4️⃣ Запустите контейнеры

```bash
make run
```
### 5️⃣ Остановка контейнеров
```bash
make stop
```
Это завершит работу всех контейнеров и очистит их.

---
