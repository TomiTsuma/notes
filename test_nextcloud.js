require('dotenv').config();
const { createClient } = require('webdav');

async function test() {
  const baseUrl = process.env.NEXTCLOUD_URL || 'http://localhost:8080';
  const url = `${baseUrl.replace(/\/+$/, '')}/remote.php/webdav`;
  const user = process.env.NEXTCLOUD_USERNAME || '';
  const pass = process.env.NEXTCLOUD_PASSWORD || '';

  if (!user || !pass) {
    console.error('Please configure NEXTCLOUD_USERNAME and NEXTCLOUD_PASSWORD in .env');
    return;
  }

  try {
    const client = createClient(url, { username: user, password: pass });
    const success = await client.exists('/');
    console.log('Connection successful:', success);
  } catch (e) {
    console.error('Connection failed:', e.message);
  }
}
test();
