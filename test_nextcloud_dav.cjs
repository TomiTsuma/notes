const { createClient } = require('webdav');
async function test() {
  const paths = ['/remote.php/webdav', '/remote.php/dav', '/dav.php'];
  const urlBase = 'http://100.100.133.10:30027';
  const user = 'aeacus';
  const pass = 'Tobirama13';
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
