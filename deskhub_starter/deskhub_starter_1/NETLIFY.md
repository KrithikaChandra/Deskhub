# Deploy DeskHub to Netlify

Netlify must serve `index.html` at the site root and include the app's `src/` folder. The `build:netlify` script builds that layout into `netlify_deploy/`.

## Important

- On Netlify, this app runs in static demo mode.
- Login and ticket lists read from `src/db.json` in the deployed files.
- Static demo mode is read-only. If you later need create/update/delete ticket actions online, host the Node/json-server API separately and set `window.DESKHUB_API_BASE_URL`.

## Option A: Drag and Drop

1. Open a terminal in `deskhub_starter_1`, the folder that contains `package.json`.
2. Run:

   ```bash
   npm install
   npm run build:netlify
   ```

3. Go to Netlify Drop or Netlify dashboard -> Sites -> Add new site -> Deploy manually.
4. Drag the `netlify_deploy` folder.
5. Open the site URL Netlify gives you.

## Option B: Git Deploy

Use this if your repo is `DeskHub_Project` and the app lives under `deskhub_starter/deskhub_starter_1`.

1. Push your code to GitHub.
2. In Netlify, choose Add new site -> Import an existing project.
3. Set Base directory to:

   ```text
   deskhub_starter/deskhub_starter_1
   ```

4. Set Build command to:

   ```bash
   npm run build:netlify
   ```

5. Set Publish directory to:

   ```text
   netlify_deploy
   ```

6. Deploy the site.

## Checklist

| Problem | What to check |
| --- | --- |
| Page not found at `/` | Deploy `netlify_deploy`, not the whole repo. Root must contain `index.html`. |
| White page | Browser F12 -> Console: if `src/main.js` is 404, `src` was not copied. Run `npm run build:netlify` again from `deskhub_starter_1`. |
| Login or tickets fail | Check that `netlify_deploy/src/db.json` exists and was deployed with the rest of the folder. |

## Optional: Hosted API URL Later

When you have a hosted API URL, add this before the app script in each HTML page:

```html
<script>
  window.DESKHUB_API_BASE_URL = "https://your-api.example.com";
</script>
```
