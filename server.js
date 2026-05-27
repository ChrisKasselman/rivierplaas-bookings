require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDB } = require('./db');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'rivierplaas-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/bookings'));
app.use('/', require('./routes/admin'));

app.get('/', (req, res) => res.redirect('/dashboard'));

const PORT = process.env.PORT || 3000;

initDB().then(() => {
  app.listen(PORT, () => console.log(`Rivierplaas Booking System running on port ${PORT}`));
}).catch(err => {
  console.error('Database init failed:', err);
  process.exit(1);
});
