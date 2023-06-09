const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { getUser } = require('../../_helpers')
const { User, Tweet, Reply, Like, Followship } = require('../../models')

const userController = {
  login: (req, res, next) => {
    try {
      const userData = getUser(req).toJSON()
      delete userData.password
      const token = jwt.sign(userData, process.env.JWT_SECRET, { expiresIn: '30d' })
      res.json({
        status: 'success',
        data: {
          token, user: userData
        }
      })
    } catch (error) {
      next(error)
    }
  },

  signUp: async (req, res, next) => {
    try {
      const errors = []
      const { name, account, email, password, checkPassword } = req.body
      // 有欄位沒有填寫 暫時的錯誤處理
      if (!name || !account || !email || !password || !checkPassword) errors.push('每個欄位都必填')
      // 密碼與確認密碼不一致
      if (password !== checkPassword) errors.push('密碼與確認密碼不一致')
      // 確認account與email是否與資料庫重複
      const [userAccount, userEmail] = await Promise.all([
        User.findOne({ where: { account } }),
        User.findOne({ where: { email } })
      ])
      if (userAccount) errors.push('account已存在')
      if (userEmail) errors.push('email已存在')
      if (errors.length) {
        // throw new Error(errors)
        return res.json({ status: 'error', message: errors })
      }
      const user = await User.create({
        name,
        account,
        email,
        password: bcrypt.hashSync(password, bcrypt.genSaltSync(10), null)
      })
      const userData = user.toJSON()
      delete userData.password
      return res.json({ status: 'success', data: userData })
    } catch (error) {
      next(error)
    }
  },
  getUserTweets: async (req, res, next) => {
    try {
      let { id } = req.params
      id = Number(id)

      // 確認使用者是否存在與發過文
      const [user, userTweets] = await Promise.all([
        User.findByPk(id),
        Tweet.findAll({
          where: { UserId: id },
          raw: true,
          nest: true
        })
      ])
      if (!user) throw new Error('The user does not exist')
      if (!userTweets.length) throw new Error("The user have'nt post any tweet yet")
      return res.json({ status: 'success', data: userTweets })
    } catch (error) {
      next(error)
    }
  },
  getUser: async (req, res, next) => {
    try {
      let id = req.params.id
      id = Number(id)

      // 確認使用者是否存在
      const user = await User.findByPk(id)
      if (!user) throw new Error('The user does not exist')
      res.json({ status: 'success', data: user })
    } catch (error) {
      next(error)
    }
  },
  getUserRepliedTweet: async (req, res, next) => {
    try {
      let { id } = req.params
      id = Number(id)

      // 確認使用者是否存在與回過文
      const [user, repliedTweets] = await Promise.all([
        User.findByPk(id),
        Reply.findAll({
          where: { UserId: id },
          include: [Tweet],
          raw: true,
          nest: true
        })
      ])
      if (!user) throw new Error('The user does not exist')
      if (!repliedTweets.length) throw new Error("The user have'nt replied any tweets yet.")

      const data = []
      for (const i of repliedTweets) {
        data.push(i.Tweet)
      }
      return res.json({ status: 'success', data })
    } catch (error) {
      next(error)
    }
  },
  getUserLiked: async (req, res, next) => {
    try {
      let { id } = req.params
      id = Number(id)

      // 確認使用者是否存在與喜歡的貼文
      const [user, userLiked] = await Promise.all([
        User.findByPk(id),
        Like.findAll({
          where: { UserId: Number(id) },
          include: [Tweet],
          raw: true,
          nest: true
        })
      ])
      if (!user) throw new Error('The user does not exist')
      if (!userLiked.length) throw new Error('He does not like anyone.')
      const data = []
      for (const i of userLiked) {
        data.push(i.Tweet)
      }
      return res.json({ status: 'success', data })
    } catch (error) {
      next(error)
    }
  },
  getUserFollows: async (req, res, next) => {
    try {
      let { id } = req.params
      id = Number(id)

      // 確認使用者是否存在其追蹤者
      const [user, userFollows] = await Promise.all([
        User.findByPk(id),
        Followship.findAll({
          where: { followerId: Number(id) },
          raw: true,
          nest: true
        })
      ])
      if (!user) throw new Error('The user does not exist')
      if (!userFollows.length) throw new Error("He haven't followed anyone")
      const data = []
      for (const i of req.user.Followings) {
        data.push(i.dataValues)
      }
      return res.json({ status: 'success', data })
    } catch (error) {
      next(error)
    }
  },
  getUserFollowers: async (req, res, next) => {
    try {
      let { id } = req.params
      id = Number(id)

      // 確認使用者是否存在其追隨者
      const [user, userFollowers] = await Promise.all([
        User.findByPk(id),
        Followship.findAll({
          where: { followingId: Number(id) }
        })
      ])
      if (!user) throw new Error('The user does not exist')
      if (!userFollowers.length) throw new Error('He is lonely')

      const data = []
      for (const i of req.user.Followers) {
        data.push(i.dataValues)
      }
      return res.json({ status: 'success', data })
    } catch (error) {
      next(error)
    }
  },
  putUser: async (req, res, next) => {
    try {
      const { email, password, name, avatar, introduction, background, account } = req.body

      if (introduction.length < 160) throw new Error('Your self-introduction is a little too long for me to handle! Please less than 160.')
      if (name.length < 50) throw new Error('Your self-introduction is a little too long for me to handle! ! Please less than 50.')
      const [checkEmail, checkAccount] = await Promise.all([
        User.findOne({ where: { email } }),
        User.findOne({ where: { account } })
      ])
      if (checkEmail) throw new Error('Oops! Your email already exist')
      if (checkAccount) throw new Error('Oops! Your account already exist')
      User.update({
        email, password, name, avatar, introduction, background, account
      })
    } catch (error) {
      next(error)
    }
  }
}

module.exports = userController
