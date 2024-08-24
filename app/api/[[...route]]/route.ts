import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import image from './image'
import openapi from './openapi'






export const runtime = 'nodejs'
const app = new Hono().basePath("/api");

const routes = app
.route("/image", image)
.route("/openapi", openapi)







export const GET = handle(app)
export const POST = handle(app)

export type AppType = typeof routes