import { Hono } from "hono";
import { z } from "zod";
import { swaggerUI, SwaggerUI } from "@hono/swagger-ui";
import { unsplash } from '@/lib/unsplash'
import { handle } from "hono/vercel";

// generate random image from unsplash
const app = new Hono()

app.get('/generate-image', async (c) => {
  try {
    const result = await unsplash.photos.getRandom({
      count: 1,
      orientation:'squarish'
    });
    if (result.type === 'error') {
      console.error('Unsplash API error:', result.errors);
      return c.json({ error: 'Failed to fetch image' }, 500);
    }
    // console.log(result)
    const imageUrl = result.response
    return c.json({ imageUrl });
  } catch (error) {
    console.error('Error fetching image:', error);
    return c.json({ error: 'Failed to fetch image' }, 500);
  }
});

export default app