if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const path = require('path')
const express = require('express')
const passport = require('./config/passport')
const flash = require('connect-flash')
const { apis, pages } = require('./routes')
const methodOverride = require('method-override')
const session = require('express-session')
const cors = require('cors')

const app = express()
const port = process.env.PORT || 8080

// 解析request主體
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(methodOverride('_method'))
app.use('/upload', express.static(path.join(__dirname, 'upload')))

// session設定
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'NonSecret',
    resave: false,
    saveUninitialized: true
  })
)

// passport初始化
app.use(passport.initialize())
// app.use(passport.session())

// flash
app.use(flash())

// cors
const corsOptions = {
  // origin: [
  //   'http://localhost:3000',
  //   'https://bluelsa.github.io',
  //   'https://s1030905.github.io',
  //   'https://4457-2001-b011-7003-76bd-f067-d1c2-c9bc-905.ngrok-free.app'
  // ],
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: ['Content-Type', 'Authorization']
}
app.use(cors(corsOptions))

// locals
app.use((req, res, next) => {
  res.locals.error_messages = req.flash('error_messages')
  next()
})

// routes
app.use('/api', apis)
app.use('/', pages)

app.listen(port, () =>
  console.log(`Example app listening on http://localhost:${port}`)
)

module.exports = app
