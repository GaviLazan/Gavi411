import express from 'express'
import listRouter from './list.js'
import adminUsersRouter from './adminUsers.js'
import detailRouter from './detail.js'
import lifecycleRouter from './lifecycle.js'
import createRouter, { stripEmpty } from './create.js'
import messagesRouter from './messages.js'
import { buildPermalink } from './buildPermalink.js'

const router = express.Router()

// Mount sub-routers in strict order: / must come after /by-public-id and /match
// to avoid catching those routes with the catch-most /:id pattern
router.use('/', listRouter)
router.use('/', adminUsersRouter)
router.use('/', detailRouter)
router.use('/', lifecycleRouter)
router.use('/', createRouter)
router.use('/', messagesRouter)

export { stripEmpty, buildPermalink }
export default router
