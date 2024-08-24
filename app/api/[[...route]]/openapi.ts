import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { cors } from 'hono/cors'

const app = new OpenAPIHono()
app.use('*', cors())
app.openapi(
  createRoute({
    method: 'get',
    path: '/hello',
    responses: {
      200: {
        description: 'Respond a message',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string()
            })
          }
        }
      }
    }
  }),
  (c) => {
    return c.json({
      message: 'hello'
    })
  }
)

app.get(
  '/ui',
  swaggerUI({
    url: '/api/openapi/doc'
  })
)

app.doc('/doc', {
  info: {
    title: 'An API',
    version: 'v1'
  },
  openapi: '3.1.0'
})

export default app