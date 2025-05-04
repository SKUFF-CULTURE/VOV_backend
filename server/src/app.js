const express = require('express');
const session = require('express-session');
const passport = require('./config/passport.js'); 
const cors = require('cors')
const app = express();
require('dotenv').config();

app.use(express.json());

app.use(cors());


const corsOptions = {
  origin: 'http://localhost:3000', 
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, 
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

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

// Подключение маршрутов
app.use('/auth', authRoutes);                 //auth (+)                        
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

