const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  throw new Error("ADMIN_TOKEN environment variable is not set!");
}

export default ADMIN_TOKEN;
