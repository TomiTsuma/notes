require('dotenv').config();
const { createClient } = require('webdav');

async function test() {
  const paths = ['/remote.php/webdav', '/remote.php/dav', '/dav.php'];
  const urlBase = process.env.NEXTCLOUD_URL || 'http://localhost:8080';
  const user = process.env.NEXTCLOUD_USERNAME || '';
  const pass = process.env.NEXTCLOUD_PASSWORD || '';

  if (!user || !pass) {
    console.error('Please configure NEXTCLOUD_USERNAME and NEXTCLOUD_PASSWORD in .env');
    return;
  }

  for (const path of paths) {
    try {
      console.log(`Testing ${urlBase}${path}...`);
      const client = createClient(`${urlBase}${path}`, { username: user, password: pass });
      const success = await client.exists('/');
      console.log(`Success with ${path}: ${success}`);
      return;
    } catch (e) {
      console.error(`Failed with ${path}: ${e.message}`);
    }
  }
}
test();
