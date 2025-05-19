const express = require('express');
const session = require('express-session');
const passport = require('./config/passport.js'); 
require('./config/passport-yandex');
const cors = require('cors')
const app = express();
require('dotenv').config();
const { ensureIndex } = require('./services/setupEs.js');
const {initBuckets} = require('./utils/minio-init.js')
app.use(express.json({limit: '10mb'}));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());

const corsOptions = {
  origin: 'http://localhost:3000', 
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, 
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Проверка индексации


app.use(session({
  secret: process.env.SESSION_SECRET || 'some_secret_key',
  resave: false,
  saveUninitialized: false
}));

// Инициализация Passport и подключение сессий Passport
app.use(passport.initialize());
app.use(passport.session());

// Импорт маршрутов
const authRoutes = require('./routes/authRoutes');
const songsRoutes = require('./routes/songs');
const restorationRoutes = require('./routes/restorationRoutes.js');
const userLibraryRoutes = require('./routes/userLibrary')
const publicLibraryRoutes = require('./routes/publicLibraryRoutes.js')
const searchRoutes = require('./routes/searchRoutes.js');

// Подключение маршрутов
app.use('/auth', authRoutes);                 //auth (+)  
app.use('/api', songsRoutes);
app.use('/restoration', restorationRoutes)
app.use('/users', userLibraryRoutes)
app.use('/public-library', publicLibraryRoutes)
app.use('/search',searchRoutes)



// Базовый роут
app.get('/', (req, res) => {
  res.send('VOV Backend is running');
});

app.post('/test', (req, res) => {
  res.json({ message: 'Test route works!' });
});
setInterval(() => {
  const { heapUsed, heapTotal } = process.memoryUsage();
  console.log(`Node.js Memory: ${Math.round(heapUsed / 1024 / 1024)}MB / ${Math.round(heapTotal / 1024 / 1024)}MB`);
}, 60000);
module.exports = app;

