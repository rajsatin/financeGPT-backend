const tokens = {}; 

export default async function handler(req, res) {  // vercel servel less function starts here
  const dotenv = await import("dotenv");
  dotenv.config();

  const baseURL = `https://${req.headers.host}`; // seperates the host and actual url 
  const url = new URL(req.url, baseURL);
  const redirectPath = `${baseURL}${url.pathname}?securityCode`;

  // Step 1: Start OAuth Flow
  if (url.searchParams.has("auth")) {
    const authUrl = `${process.env.ZOHO_API_DOMAIN}/oauth/v2/auth` +
      `?scope=ZohoBooks.fullaccess.all` +
      `&client_id=${process.env.CLIENT_ID}` +
      `&response_type=code` +
      `&access_type=offline` +
      `&redirect_uri=${redirectPath}`; // securityCode
    return res.writeHead(302, { Location: authUrl }).end();
  }

  // Step 2: Exchange Code for Token
  if (url.searchParams.has("securityCode")) {
    const code = url.searchParams.get("code");
    const tokenUrl = `${process.env.ZOHO_API_DOMAIN}/oauth/v2/token`;

    try {
      const params = new URLSearchParams({
        code,
        redirect_uri: redirectPath,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "authorization_code"
      });

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
      });

      const data = await response.json();

      if (data.error) {
        console.error("Token Error:", data);
        return res.status(401).json({ error: data });
      }

      tokens.access_token = data.access_token;
      tokens.refresh_token = data.refresh_token;

      return res.status(200).send("✅ Authorization successful. You can now call /api/invoices to fetch your details.");
    } catch (err) {
      console.error("Token exchange failed:", err);
      return res.status(500).send("Token exchange failed");
    }
  }

  // Step 3: Fetch details (Only if token is available)
  if (!tokens.access_token) {
    return res.status(401).send("❌ Not authorized. Please visit /api/invoices?auth to start.");
  }

  try {
    const page = 1;
    const perPage = 20;
    const orgId = process.env.ZOHO_ORGANISATION_ID;
    const apiUrl = `https://www.zohoapis.in/books/v3/invoices?organization_id=${orgId}&page=${page}&per_page=${perPage}`;

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Zoho-oauthtoken ${tokens.access_token}`
      }
    });

    const data = await response.json();

    if (data.code === 57) {
      return res.status(403).send("❌ Access token invalid or expired. Please reauthorize.");
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Fetch error:", err);
    return res.status(500).send("Failed to fetch Invoices");
  }
}
