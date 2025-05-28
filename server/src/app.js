const express = require("express");
const session = require("express-session");
const passport = require("./config/passport.js");
require("./config/passport-yandex");
const cors = require("cors");
const { toASCII } = require("punycode"); // Импорт toASCII из punycode
const app = express();
require("dotenv").config();
const { ensureIndex } = require("./services/setupEs.js");
const { initBuckets } = require("./utils/minio-init.js");
const { connectProducer } = require("./services/kafka.js");

// Преобразование всех CORS_ORIGINS в punycode
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((origin) => {
      try {
        const url = new URL(origin.trim());
        const hostASCII = toASCII(url.hostname);
        return `${url.protocol}//${hostASCII}${url.port ? ":" + url.port : ""}`;
      } catch (e) {
        return origin.trim(); // Если не URL, возвращаем как есть
      }
    })
  : ["http://localhost:5173", "http://frontend:3000"]; // Значения по умолчанию

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const corsOptions = {
  origin: function (origin, callback) {
    // Логируем входящий origin для отладки
    console.log("Incoming origin:", origin);

    // Преобразуем входящий origin в punycode
    let safeOrigin = origin;
    if (origin) {
      try {
        const url = new URL(origin);
        const hostASCII = toASCII(url.hostname);
        safeOrigin = `${url.protocol}//${hostASCII}${url.port ? ":" + url.port : ""}`;
      } catch (e) {
        console.log("Invalid origin URL:", origin);
      }
    }

    if (!origin || allowedOrigins.includes(safeOrigin)) {
      callback(null, origin || true); // Возвращаем оригинальный origin или true для не-CORS запросов
    } else {
      console.log("CORS rejected. Allowed origins:", allowedOrigins);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  credentials: true,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));

// Настройка сессий
app.use(
  session({
    secret: process.env.SESSION_SECRET || "some_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);

// Инициализация Passport
app.use(passport.initialize());
app.use(passport.session());

// Импорт маршрутов
const authRoutes = require("./routes/authRoutes");
const songsRoutes = require("./routes/songs");
const restorationRoutes = require("./routes/restorationRoutes.js");
const userLibraryRoutes = require("./routes/userLibrary");
const publicLibraryRoutes = require("./routes/publicLibraryRoutes.js");
const searchRoutes = require("./routes/searchRoutes.js");

// Подключение маршрутов
app.use("/api/auth", authRoutes);
app.use("/api", songsRoutes);
app.use("/api/restoration", restorationRoutes);
app.use("/api/users", userLibraryRoutes);
app.use("/api/public-library", publicLibraryRoutes);
app.use("/api/search", searchRoutes);

// Базовый роут
app.get("/", (req, res) => {
  res.send("VOV Backend is running");
});

app.post("/test", (req, res) => {
  res.json({ message: "Test route works!" });
});

// Инициализация сервисов
const initServices = async () => {
  try {
    console.log("🚀 Инициализация сервисов...");

    // Инициализация Elasticsearch
    await ensureIndex();
    console.log("✅ Elasticsearch индексы готовы");

    // Инициализация MinIO
    await initBuckets();
    console.log("✅ MinIO бакеты готовы");

    // Инициализация Kafka Producer
    await connectProducer();
    console.log("✅ Kafka Producer подключён");
  } catch (error) {
    console.error("❌ Ошибка при инициализации сервисов:", error);
    process.exit(1); // Завершаем процесс, если инициализация не удалась
  }
};

// Запуск инициализации сервисов
initServices().then(() => {
  // Мониторинг памяти
  setInterval(() => {
    const { heapUsed, heapTotal } = process.memoryUsage();
    console.log(
      `Node.js Memory: ${Math.round(heapUsed / 1024 / 1024)}MB / ${Math.round(
        heapTotal / 1024 / 1024
      )}MB`
    );
  }, 60000);
});

module.exports = app;