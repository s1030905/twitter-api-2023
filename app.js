if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const express = require('express')
const { getUser } = require('./_helpers')
const passport = require('./config/passport')
const { apis } = require('./routes')

const app = express()
const port = 3000

// 解析request主體
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// passport初始化
app.use(passport.initialize())

// // locals
app.use((req, res, next) => {
  res.locals.user = getUser(req)
  next()
})

// routes
app.use('/api', apis)

app.listen(port, () => console.log(`Example app listening on http://localhost:${port}`))

module.exports = app
