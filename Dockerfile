FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data && chmod 777 /app/data

# Дефолты окружения. Хост (bothost) может переопределить любой из них.
# PORT читается из окружения процесса — приложение слушает именно его.
ENV PORT=8000 \
    SEED_ON_START=1 \
    DATA_DIR=/app/data

EXPOSE 8000

CMD ["python", "main.py"]
