const tokens = {}; // WARNING: in-memory token storage - reset on cold start

export default async function handler(req, res) {
  const { url, method } = req;
  const dotenv = await import("dotenv");
  dotenv.config();

  console.log("Request URL:", url);

  if (url.startsWith("/api/auth")) {
    const authUrl = `${process.env.ZOHO_API_DOMAIN}/oauth/v2/auth` +
      `?scope=ZohoBooks.fullaccess.all` +
      `&client_id=${process.env.CLIENT_ID}` +
      `&response_type=code` +
      `&access_type=offline` +
      `&redirect_uri=${process.env.REDIRECT_URI}`;
    console.log("Redirecting to Zoho Auth URL:", authUrl);
    return res.writeHead(302, { Location: authUrl }).end();
  }

  if (url.startsWith("/api/oauth/financeCode")) {
    const code = new URL(req.url, `https://${req.headers.host}`).searchParams.get("code");
    console.log("OAuth code received:", code);
    const tokenUrl = `${process.env.ZOHO_API_DOMAIN}/oauth/v2/token`;

    try {
      const params = new URLSearchParams();
      params.append('code', code);
      params.append('redirect_uri', process.env.REDIRECT_URI);
      params.append('client_id', process.env.CLIENT_ID);
      params.append('client_secret', process.env.CLIENT_SECRET);
      params.append('grant_type', 'authorization_code');

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });

      const data = await response.json();

      console.log("Token exchange response:", data);

      tokens.access_token = data.access_token;
      tokens.refresh_token = data.refresh_token;

      return res.status(200).send("Authorization successful! Tokens received.");
    } catch (err) {
      console.error("Token exchange error:", err);
      return res.status(500).send("Token exchange failed");
    }
  }

  if (url.startsWith("/api/contacts")) {
    try {
      const orgId = process.env.ZOHO_ORGANISATION_ID;
      console.log("Using Organisation ID:", orgId);
      console.log("Using Access Token:", tokens.access_token);

      const apiUrl = `https://www.zohoapis.in/books/v3/contacts?organization_id=${orgId}`;

      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Zoho-oauthtoken ${tokens.access_token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Zoho API call failed:", errorText);
        return res.status(response.status).send(`API call failed: ${errorText}`);
      }

      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      console.error("Fetch error:", err);
      return res.status(500).send("Failed to fetch contacts");
    }
  }

  return res.status(404).send("Route not found");
}
