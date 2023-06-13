const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { getUser } = require('../../_helpers')
const { imgurFileHandler, localFileHandler } = require('../../helpers/file-helper')
const { User, Tweet, Reply, Like, Followship } = require('../../models')

const userController = {
  login: (req, res, next) => {
    try {
      const userData = getUser(req).toJSON()
      delete userData.password
      const token = jwt.sign(userData, process.env.JWT_SECRET, { expiresIn: '30d' })
      res.status(200).json({
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
      // 確認account與email是否 與 資料庫重複
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
      return res.status(200).json({ status: 'success', data: userData })
    } catch (error) {
      next(error)
    }
  },
  getUserTweets: async (req, res, next) => {
    try {
      let { id } = req.params
      id = Number(id)

      // 確認使用者是否存在 與 發過文
      const [user, userTweets] = await Promise.all([
        User.findByPk(id),
        Tweet.findAll({
          where: { UserId: id },
          include: [
            { model: User, as: 'TweetUser', attributes: ['id', 'name', 'account', 'avatar'] },
            { model: Reply, as: 'TweetReply', attributes: ['id'] }
          ],
          nest: true
        })
      ])
      // 錯誤處理
      if (!user || user.role === 'admin') {
        const error = new Error('The user does not exist')
        error.status = 404
        throw error
      }
      if (!userTweets.length) {
        const error = new Error("The user have'nt post any tweet yet")
        error.status = 404
        throw error
      }
      for (const i of userTweets) {
        i.dataValues.tweetReplyCount = i.dataValues.TweetReply.length
        delete i.dataValues.TweetReply
      }
      return res.status(200).json(userTweets)
    } catch (error) {
      next(error)
    }
  },
  getUser: async (req, res, next) => {
    try {
      let id = req.params.id
      id = Number(id)

      const [followingCount, followerCount, user] = await Promise.all([
        Followship.findAndCountAll({ where: { followerId: id } }),
        Followship.findAndCountAll({ where: { followingId: id } }),
        User.findByPk(id, {
          include: [{ model: Tweet, as: 'UserTweets' }]
        })
      ])

      // 確認使用者是否存在
      if (!user || user.role === 'admin') {
        const error = new Error('The tweet does not exist')
        error.status = 404
        throw error
      }

      const data = user.toJSON()
      data.userTweetCount = data.UserTweets.length
      data.followingCount = followingCount.count
      data.followerCount = followerCount.count
      delete data.UserTweets
      return res.status(200).json(data)
    } catch (error) {
      next(error)
    }
  },
  getUserRepliedTweet: async (req, res, next) => {
    try {
      let { id } = req.params
      id = Number(id)

      // 確認使用者是否存在 與 回過文
      const [user, repliedTweets] = await Promise.all([
        User.findByPk(id),
        Reply.findAll({
          where: { UserId: id },
          include: [
            {
              model: Tweet,
              attributes: ['id', 'UserId'],
              include: [{ model: User, as: 'TweetUser', attributes: ['id', 'name', 'account'] }]
            },
            { model: User, as: 'RepliedUser', attributes: ['id', 'name', 'account', 'avatar'] }],
          raw: true,
          nest: true
        })
      ])

      // 錯誤處理
      if (!user || user.role === 'admin') {
        const error = new Error('The user does not exist')
        error.status = 404
        throw error
      }
      if (!repliedTweets.length) {
        const error = new Error("The user have'nt replied any tweets yet.")
        error.status = 404
        throw error
      }

      const data = []
      for (const i of repliedTweets) {
        data.push(i.Tweet)
      }
      return res.status(200).json(repliedTweets)
    } catch (error) {
      next(error)
    }
  },
  getUserLiked: async (req, res, next) => {
    try {
      let { id } = req.params
      id = Number(id)

      // 確認使用者是否存在 與 喜歡的貼文
      const [user, userLiked] = await Promise.all([
        User.findByPk(id),
        Like.findAll({
          where: { UserId: Number(id) },
          include: [Tweet, { model: User, as: 'LikedUser', attributes: ['id', 'name', 'account', 'avatar'] }],
          raw: true,
          nest: true
        })
      ])
      // 錯誤處理
      if (!user || user.role === 'admin') {
        const error = new Error('The user does not exist')
        error.status = 404
        throw error
      }
      if (!userLiked.length) {
        const error = new Error('He does not like tweet.')
        error.status = 404
        throw error
      }
      const data = []
      for (const i of userLiked) {
        data.push(i.Tweet)
      }
      return res.status(200).json(userLiked)
    } catch (error) {
      next(error)
    }
  },
  getUserFollows: async (req, res, next) => {
    try {
      let { id } = req.params
      id = Number(id)

      // 確認使用者是否存在 與 其追蹤者
      const [user, userFollows] = await Promise.all([
        User.findByPk(id),
        Followship.findAll({
          where: { followerId: Number(id) },
          include: [{ model: User, as: 'Followings', attributes: ['id', 'name', 'account', 'avatar', 'introduction'] }],
          raw: true,
          nest: true
        })
      ])

      // 錯誤處理
      if (!user || user.role === 'admin') {
        const error = new Error('The user does not exist')
        error.status = 404
        throw error
      }
      if (!userFollows.length) {
        const error = new Error("He haven't followed anyone")
        error.status = 404
        throw error
      }

      return res.status(200).json(userFollows)
    } catch (error) {
      next(error)
    }
  },
  getUserFollowers: async (req, res, next) => {
    try {
      let { id } = req.params
      id = Number(id)

      // 確認使用者是否存在 與 其追隨者
      const [user, userFollowers] = await Promise.all([
        User.findByPk(id),
        Followship.findAll({
          where: { followingId: Number(id) },
          include: [{ model: User, as: 'Followers', attributes: ['id', 'name', 'account', 'avatar', 'introduction'] }]
        })
      ])

      // 錯誤處理
      if (!user || user.role === 'admin') {
        const error = new Error('The user does not exist')
        error.status = 404
        throw error
      }
      if (!userFollowers.length) {
        const error = new Error('He is lonely')
        error.status = 404
        throw error
      }

      return res.status(200).json(userFollowers)
    } catch (error) {
      next(error)
    }
  },
  editUserProfile: async (req, res, next) => {
    try {
      const { name, introduction } = req.body
      let { id } = req.params
      id = Number(id)

      // 使用者不能編輯他人資料
      if (getUser(req).id !== id) {
        const error = new Error('You can only edit your profile')
        error.status = 403
        throw error
      }

      // introduction與name的字數限制
      if (introduction.length > 160) {
        const error = new Error('Your self-introduction is a little too long for me to handle! Please less than 160.')
        error.status = 400
        throw error
      }
      if (name.length > 50) {
        const error = new Error('Your self-introduction is a little too long for me to handle! ! Please less than 50.')
        error.status = 400
        throw error
      }

      const user = await User.findByPk(id)
      // 錯誤處理
      if (!user || user.role === 'admin') {
        const error = new Error('The user does not exist')
        error.status = 404
        throw error
      }

      // 檔案承接
      const { files } = req

      if (files) {
        const [avatar, background] = await Promise.all([
          files.avatar ? await imgurFileHandler(files.avatar[0]) : null,
          files.background ? await imgurFileHandler(files.background[0]) : null
        ])

        const updatedUser = await user.update({
          name,
          introduction,
          avatar: avatar || user.avatar,
          background: background || user.background
        })

        return res.status(200).json(updatedUser)
      } else {
        const updatedUser = await user.update({
          name,
          introduction,
          avatar: user.avatar,
          background: user.background
        })
        return res.status(200).json(updatedUser)
      }
    } catch (error) {
      next(error)
    }
  },
  putUserSetting: async (req, res, next) => {
    try {
      const { account, name, email, introduction, password, checkPassword } = req.body
      let { id } = req.params
      id = Number(id)

      // introduction與name的字數限制
      if (introduction.length > 160) {
        const error = new Error('Your self-introduction is a little too long for me to handle! Please less than 160.')
        error.status = 400
        throw error
      }
      if (name.length > 50) {
        const error = new Error('Your self-introduction is a little too long for me to handle! ! Please less than 50.')
        error.status = 400
        throw error
      }

      // check password
      if (password !== checkPassword) {
        const error = new Error('Password does not match the confirmation password.')
        error.status = 400
        throw error
      }

      // 使用者不能編輯他人資料
      if (getUser(req).id !== id) {
        const error = new Error('You can only edit your profile')
        error.status = 403
        throw error
      }

      // 檢查account, email 是否重複
      const [userAccount, userEmail] = await Promise.all([
        User.findOne({ where: { account } }),
        User.findOne({ where: { email } })
      ])
      if (userAccount) {
        const error = new Error('Account already exist')
        error.status = 400
        throw error
      }
      if (userEmail) {
        const error = new Error('Email already exist')
        error.status = 400
        throw error
      }

      const user = await User.findByPk(id)
      const updatedUser = await user.update({
        account: account || user.account,
        name: name || user.name,
        email: email || user.email,
        password: password ? bcrypt.hashSync(password) : user.password,
        introduction: introduction || user.introduction
      })

      return res.status(200).json(updatedUser)
    } catch (err) {
      next(err)
    }
  }
}

module.exports = userController
